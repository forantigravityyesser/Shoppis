import type { OrderStatus } from '../../domain/models/order';
import type {
  OrderRealtimeEvent,
  OrderRealtimeHandlers,
  OrderRealtimePort,
} from '../../application/ports/order-realtime';
import { insforge } from '../insforge/client';

/**
 * Realtime-адаптер заказов поверх InsForge Realtime (docs/22 ORD-14).
 *
 * Infrastructure владеет wire-деталями: именами каналов (`orders:seller:<id>` /
 * `orders:buyer:<id>`, миграция `0047`) и форматом сообщения. Application видит
 * только доменные `OrderRealtimeHandlers`.
 *
 * Модель соединения:
 * - **Persistent-сокет**: соединение живёт на протяжении сессии приложения и НЕ
 *   закрывается, когда уходит последний слушатель (закрываем только канал).
 *   Так навигация между экранами (список ↔ деталь) не рвёт сокет и не создаёт
 *   окно, в котором теряются события.
 * - **Ретраи**: первичный провал `connect()` или отказ `subscribe()` (`{ ok:false }`)
 *   планирует повтор с экспоненциальным backoff (сброс при успехе).
 * - **Resync**: SDK сам переподключается и переподписывает каналы; адаптер слушает
 *   `connect` и после восстановления соединения (не первого коннекта) зовёт
 *   `onResync` — за время разрыва события могли потеряться, нужна сверка с сервером.
 * - **Рефкаунт каналов**: подписки на один канал разделяются между слушателями;
 *   `dispatch` маршрутизирует сообщение по `meta.channel`.
 *
 * Всё best-effort: любой сбой сокета логируется и не влияет на UI — экран заказов
 * продолжает работать без realtime.
 */

const ORDER_EVENTS = ['order_created', 'order_status_changed'] as const;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

/** Активные каналы → множество обработчиков (рефкаунт подписки). */
const channels = new Map<string, Set<OrderRealtimeHandlers>>();

let customListenersBound = false;
let lifecycleBound = false;
let everConnected = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = BASE_BACKOFF_MS;

function normalize(message: unknown): OrderRealtimeEvent | null {
  const source = message as { orderId?: unknown; status?: unknown } | null;
  const orderId = source?.orderId;
  const status = source?.status;
  if (typeof orderId !== 'string' || typeof status !== 'string') return null;
  return { orderId, status: status as OrderStatus };
}

function dispatch(message: unknown): void {
  const channel = (message as { meta?: { channel?: unknown } } | null)?.meta?.channel;
  if (typeof channel !== 'string') return;
  const handlers = channels.get(channel);
  if (!handlers || handlers.size === 0) return;
  const event = normalize(message);
  if (!event) return;
  for (const handler of handlers) {
    try {
      handler.onChange(event);
    } catch (e) {
      console.error('[order-realtime] onChange threw:', e);
    }
  }
}

function resyncAll(): void {
  for (const handlers of channels.values()) {
    for (const handler of handlers) {
      try {
        handler.onResync?.();
      } catch (e) {
        console.error('[order-realtime] onResync threw:', e);
      }
    }
  }
}

function bindCustomListeners(): void {
  if (customListenersBound) return;
  customListenersBound = true;
  for (const name of ORDER_EVENTS) {
    insforge.realtime.on(name, dispatch);
  }
}

function clearRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry(): void {
  if (retryTimer || channels.size === 0) return;
  const delay = backoffMs;
  backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void syncAll();
  }, delay);
}

function bindLifecycle(): void {
  if (lifecycleBound) return;
  lifecycleBound = true;
  // SDK переподключается сам (socket.io reconnection) и переподписывает каналы.
  // Нам важно узнать о восстановлении, чтобы сверить состояние с сервером.
  insforge.realtime.on('connect', () => {
    const reconnected = everConnected;
    void syncAll().then(() => {
      if (reconnected) resyncAll();
    });
  });
  insforge.realtime.on('disconnect', (reason) => {
    console.warn('[order-realtime] disconnected:', reason);
  });
  // Провал (пере)подключения: страхуемся ретраем с backoff — SDK тоже переподключается
  // сам, но если и он не смог, мы не должны тихо остаться без realtime.
  insforge.realtime.on('connect_error', (error) => {
    console.warn('[order-realtime] connect_error:', error);
    scheduleRetry();
  });
  insforge.realtime.on('error', (error) => {
    console.warn('[order-realtime] error:', error);
  });
}

/** Подключиться и подписаться на все активные каналы; при сбое — запланировать ретрай. */
async function syncAll(): Promise<void> {
  bindCustomListeners();
  bindLifecycle();
  if (channels.size === 0) return;

  try {
    if (!insforge.realtime.isConnected) {
      await insforge.realtime.connect();
    }
  } catch (e) {
    console.warn('[order-realtime] connect failed, will retry:', e);
    scheduleRetry();
    return;
  }

  let allOk = true;
  const subscribed = new Set(insforge.realtime.getSubscribedChannels());
  for (const channel of [...channels.keys()]) {
    // Канал мог быть отписан, пока шёл async-connect — не подписываем «висячий».
    if (!channels.has(channel) || subscribed.has(channel)) continue;
    try {
      const response = await insforge.realtime.subscribe(channel);
      if (!response || response.ok !== true) {
        allOk = false;
        console.warn('[order-realtime] subscribe rejected:', channel, response);
      }
    } catch (e) {
      allOk = false;
      console.warn('[order-realtime] subscribe failed:', e);
    }
  }

  if (allOk) {
    backoffMs = BASE_BACKOFF_MS;
    everConnected = true;
    clearRetry();
  } else {
    scheduleRetry();
  }
}

function subscribe(channel: string, handlers: OrderRealtimeHandlers): () => void {
  let set = channels.get(channel);
  if (!set) {
    set = new Set();
    channels.set(channel, set);
  }
  set.add(handlers);
  void syncAll();

  return () => {
    const current = channels.get(channel);
    if (!current) return;
    current.delete(handlers);
    if (current.size > 0) return;
    channels.delete(channel);
    try {
      insforge.realtime.unsubscribe(channel);
    } catch (e) {
      console.warn('[order-realtime] unsubscribe failed:', e);
    }
    // Сокет намеренно НЕ закрываем — соединение живёт на сессию (persistent).
  };
}

export const subscribeStoreOrders: OrderRealtimePort['subscribeStoreOrders'] = (storeId, handlers) =>
  subscribe(`orders:seller:${storeId}`, handlers);

export const subscribeBuyerOrders: OrderRealtimePort['subscribeBuyerOrders'] = (userId, handlers) =>
  subscribe(`orders:buyer:${userId}`, handlers);

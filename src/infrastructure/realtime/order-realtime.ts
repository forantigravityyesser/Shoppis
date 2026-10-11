import type { OrderStatus } from '../../domain/models/order';
import type {
  OrderRealtimeEvent,
  OrderRealtimeListener,
  OrderRealtimePort,
} from '../../application/ports/order-realtime';
import { insforge } from '../insforge/client';

/**
 * Realtime-адаптер заказов поверх InsForge Realtime (docs/22 ORD-14).
 *
 * Infrastructure владеет wire-деталями: именами каналов (`orders:seller:<id>` /
 * `orders:buyer:<id>`, миграция `0047`) и форматом сообщения. Application видит
 * только доменные `OrderRealtimeEvent`.
 *
 * Одно соединение на приложение: подписки рефкаунтятся по каналу, глобальные
 * listener'ы вешаются один раз и маршрутизируют сообщение в слушателей канала
 * (`meta.channel`). Всё best-effort: любой сбой сокета логируется и не влияет
 * на UI — экран заказов продолжает работать без realtime.
 */

const ORDER_EVENTS = ['order_created', 'order_status_changed'] as const;

const listenersByChannel = new Map<string, Set<OrderRealtimeListener>>();
let listenersBound = false;
let everConnected = false;

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
  const listeners = listenersByChannel.get(channel);
  if (!listeners || listeners.size === 0) return;
  const event = normalize(message);
  if (!event) return;
  for (const listener of listeners) listener(event);
}

function bindGlobalListeners(): void {
  if (listenersBound) return;
  listenersBound = true;
  for (const name of ORDER_EVENTS) {
    insforge.realtime.on(name, dispatch);
  }
}

async function ensureChannel(channel: string): Promise<void> {
  bindGlobalListeners();
  try {
    if (!insforge.realtime.isConnected) {
      await insforge.realtime.connect();
    }
    if (!insforge.realtime.getSubscribedChannels().includes(channel)) {
      await insforge.realtime.subscribe(channel);
    }
    everConnected = true;
  } catch (e) {
    console.warn('[order-realtime] subscribe failed:', e);
  }
}

function subscribe(channel: string, listener: OrderRealtimeListener): () => void {
  let listeners = listenersByChannel.get(channel);
  if (!listeners) {
    listeners = new Set();
    listenersByChannel.set(channel, listeners);
    void ensureChannel(channel);
  }
  listeners.add(listener);

  return () => {
    const current = listenersByChannel.get(channel);
    if (!current) return;
    current.delete(listener);
    if (current.size > 0) return;
    listenersByChannel.delete(channel);
    try {
      insforge.realtime.unsubscribe(channel);
    } catch (e) {
      console.warn('[order-realtime] unsubscribe failed:', e);
    }
    if (listenersByChannel.size === 0 && everConnected) {
      try {
        insforge.realtime.disconnect();
      } catch {
        // ignore — соединение всё равно best-effort
      }
    }
  };
}

export const subscribeStoreOrders: OrderRealtimePort['subscribeStoreOrders'] = (storeId, listener) =>
  subscribe(`orders:seller:${storeId}`, listener);

export const subscribeBuyerOrders: OrderRealtimePort['subscribeBuyerOrders'] = (userId, listener) =>
  subscribe(`orders:buyer:${userId}`, listener);

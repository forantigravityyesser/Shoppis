import type { OrderStatus } from '../../domain/models/order';

/**
 * Сигнал realtime о заказе: какой заказ изменился и его новый статус.
 * Содержит только id + статус (без PII) — данные для UI не берутся из сокета,
 * а перечитываются через авторитетный query-контур (`order-queries`).
 */
export interface OrderRealtimeEvent {
  orderId: string;
  status: OrderStatus;
}

export type OrderRealtimeListener = (event: OrderRealtimeEvent) => void;

/**
 * Обработчики подписки на доменный поток скоупа.
 *
 * - `onChange` — пришёл сигнал об изменении заказа (id + новый статус).
 * - `onResync` — соединение было восстановлено после разрыва: за время простоя
 *   события могли быть потеряны, поэтому потребитель обязан сверить состояние с
 *   сервером (инвалидировать кэш), а не полагаться только на сокет.
 */
export interface OrderRealtimeHandlers {
  onChange: OrderRealtimeListener;
  onResync?: () => void;
}

/**
 * Порт push-уведомлений о заказах (docs/22 ORD-14). Application не открывает
 * сокет сам: он подписывается на доменный поток скоупа и на любой сигнал
 * инвалидирует React Query, после чего данные перечитываются существующим
 * authenticated-контуром. Имена каналов и wire-формат живут в infrastructure.
 *
 * BEST-EFFORT: недоступность сокета не должна ломать экран заказов — подписка
 * обязана не бросать и возвращать безопасный no-op отписки при сбое. Повторные
 * попытки подключения/восстановление соединения — ответственность адаптера.
 */
export interface OrderRealtimePort {
  /** Изменения заказов магазина продавца (все статусы). Возвращает отписку. */
  subscribeStoreOrders(storeId: string, handlers: OrderRealtimeHandlers): () => void;
  /** Изменения собственных заказов покупателя. Возвращает отписку. */
  subscribeBuyerOrders(userId: string, handlers: OrderRealtimeHandlers): () => void;
}

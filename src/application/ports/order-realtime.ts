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
 * Порт push-уведомлений о заказах (docs/22 ORD-14). Application не открывает
 * сокет сам: он подписывается на доменный поток скоупа и на любой сигнал
 * инвалидирует React Query, после чего данные перечитываются существующим
 * authenticated-контуром. Имена каналов и wire-формат живут в infrastructure.
 *
 * BEST-EFFORT: недоступность сокета не должна ломать экран заказов — подписка
 * обязана не бросать и возвращать безопасный no-op отписки при сбое.
 */
export interface OrderRealtimePort {
  /** Изменения заказов магазина продавца (все статусы). Возвращает отписку. */
  subscribeStoreOrders(storeId: string, listener: OrderRealtimeListener): () => void;
  /** Изменения собственных заказов покупателя. Возвращает отписку. */
  subscribeBuyerOrders(userId: string, listener: OrderRealtimeListener): () => void;
}

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deps } from '../composition/container';
import { useStore } from '../store';
import { invalidateOrderLists, orderKeys } from '../orders/order-cache';
import type { OrderRealtimeEvent } from '../ports/order-realtime';
import type { OrderScope } from '../read-models/order';

export interface OrdersRealtimeParams {
  scope: OrderScope;
  /** Storefront контекст продавца; по умолчанию — текущий `storeId`. */
  storeRef?: string | null;
  enabled?: boolean;
}

/**
 * Realtime-инвалидация контура заказов (docs/22 ORD-14). Подписывается на канал
 * скоупа (продавец — магазин, покупатель — собственные заказы) и на любой сигнал
 * инвалидирует React Query: и список, и деталь изменившегося заказа. Payload сокета
 * в UI не рендерится — он лишь триггерит повторное чтение через авторитетный
 * `order-queries`. Сокет best-effort: без него экран работает как раньше.
 *
 * Почему одновременно сервер-пуш патч и инвалидации:
 * - кэш детали изменившегося заказа патчится на месте новым статусом
 *   (`setQueryData`): открытая карточка переключается мгновенно, без ожидания
 *   перечитывания. `prev` может быть `null`/ещё не загружен — тогда патч no-op,
 *   а инвалидация ниже планирует авторитетное чтение.
 * - список — целиком (`['orders']`): покрывает ВСЕ таб-фильтры, а не только активный.
 *   Иначе неактивный таб остаётся со старым статусом и тот же заказ «клонируется»
 *   в другом статусе при переключении вкладок.
 * - detail — точечно по `event.orderId` (не только для открытого): даже если деталь
 *   сейчас не на экране, её кэш помечается stale и перечитается при следующем
 *   открытии (остальные поля, кроме статуса, пересчитываются авторитетно).
 *
 * Ресинк после реконнекта: сокет мог пропустить события за время разрыва, поэтому
 * `onResync` инвалидирует список И все детали (`detailRoot`) — полная сверка.
 */
export function useOrdersRealtime(params: OrdersRealtimeParams): void {
  const queryClient = useQueryClient();
  const storeId = useStore((s) => s.storeId);
  const userId = useStore((s) => s.serverUser?.id ?? null);

  const scope = params.scope;
  const storeRef = params.storeRef !== undefined ? params.storeRef : storeId;
  const enabled = params.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    const onChange = (event: OrderRealtimeEvent) => {
      queryClient.setQueryData(orderKeys.detail(userId, scope, event.orderId), (prev: unknown) =>
        prev && typeof prev === 'object' ? { ...prev, status: event.status } : prev,
      );
      void invalidateOrderLists(queryClient);
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(userId, scope, event.orderId) });
    };

    const onResync = () => {
      void invalidateOrderLists(queryClient);
      void queryClient.invalidateQueries({ queryKey: orderKeys.detailRoot, refetchType: 'all' });
    };

    if (scope === 'seller') {
      if (!storeRef) return;
      return deps().orderRealtime.subscribeStoreOrders(storeRef, { onChange, onResync });
    }
    if (!userId) return;
    return deps().orderRealtime.subscribeBuyerOrders(userId, { onChange, onResync });
  }, [enabled, scope, storeRef, userId, queryClient]);
}

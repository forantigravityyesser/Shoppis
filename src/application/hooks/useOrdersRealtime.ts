import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deps } from '../composition/container';
import { useStore } from '../store';
import { orderKeys } from './useOrders';
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
 * Почему инвалидируется и список, и detail конкретного заказа:
 * - список — целиком (`['orders']`): покрывает ВСЕ таб-фильтры, а не только активный.
 *   Иначе неактивный таб остаётся со старым статусом и тот же заказ «клонируется»
 *   в другом статусе при переключении вкладок.
 * - detail — точечно по `event.orderId` (не только для открытого): даже если деталь
 *   сейчас не на экране, её кэш помечается stale и перечитается при следующем
 *   открытии. Раньше detail инвалидировался лишь когда он уже был открыт, поэтому
 *   карточка в списке показывала новый статус, а сама деталь — старый.
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

    const refresh = (event: OrderRealtimeEvent) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.listRoot });
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(scope, event.orderId) });
    };

    if (scope === 'seller') {
      if (!storeRef) return;
      return deps().orderRealtime.subscribeStoreOrders(storeRef, refresh);
    }
    if (!userId) return;
    return deps().orderRealtime.subscribeBuyerOrders(userId, refresh);
  }, [enabled, scope, storeRef, userId, queryClient]);
}

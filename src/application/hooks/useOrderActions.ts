import { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deps } from '../composition/container';
import { useStore } from '../store';
import { invalidateOrderLists, orderKeys } from '../orders/order-cache';
import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../../domain/models/order';
import type { OrderActor } from '../../domain/rules/order-rules';

export interface CancelOrderVars {
  orderId: string;
  actor: OrderActor;
  reason?: string;
}

export interface TransitionOrderVars {
  orderId: string;
  toStatus: OrderStatus;
  reason?: string;
}

export interface DeliveryOutcomeVars {
  orderId: string;
  outcome: DeliveryOutcome;
  reason?: RefusalReasonCode;
}

export interface OrderActionsState {
  cancelOrder: (vars: CancelOrderVars) => Promise<void>;
  transitionOrder: (vars: TransitionOrderVars) => Promise<void>;
  recordDeliveryOutcome: (vars: DeliveryOutcomeVars) => Promise<void>;
  /** Хотя бы одна мутация в полёте (UI блокирует повторный submit). */
  isPending: boolean;
  error: Error | null;
}

/**
 * Команды жизненного цикла заказа (docs/22 §5.2, §5.8, ORD-04). Единственный
 * command-path — edge `order-actions` (actor из сессии, атомарно с inventory/history).
 * Без optimistic status: после успеха инвалидируются `['orders']`/`['order']`; для
 * seller-контекста дополнительно перечитывается инвентарь существующим контрактом
 * `fetchCatalog` (не копируем inventory-state).
 */
export function useOrderActions(): OrderActionsState {
  const queryClient = useQueryClient();
  const sessionToken = useStore((s) => s.sessionToken);

  const refreshAfterSuccess = useCallback(async () => {
    await Promise.all([
      // Все списки + неактивные табы: после смены статуса заказ обязан уйти из старого
      // таба, а не «клонироваться» (docs/22 ORD-14).
      invalidateOrderLists(queryClient),
      queryClient.invalidateQueries({ queryKey: orderKeys.detailRoot, refetchType: 'all' }),
    ]);
    // Inventory живёт в Zustand (product-slice); обновляем по существующему
    // контракту только в seller-контексте (buyer-store inventory не трогаем).
    const { context, storeId, fetchCatalog } = useStore.getState();
    if (context === 'seller' && storeId) {
      try {
        await fetchCatalog(storeId);
      } catch {
        // best-effort: провал перечитывания инвентаря не ломает результат команды.
      }
    }
  }, [queryClient]);

  // Ошибка команды не гарантирует, что локальный список актуален (статус мог
  // измениться на сервере другим актором). Деталь чинит сам view (`refetch`), а
  // список обязан перечитаться здесь (docs/24 §2.7 D10, ORD-HARDEN-04).
  const refreshListsAfterError = useCallback(() => {
    void invalidateOrderLists(queryClient);
  }, [queryClient]);

  const cancel = useMutation({
    mutationFn: (vars: CancelOrderVars) =>
      deps().orderApi.cancelOrder(sessionToken as string, vars.orderId, vars.actor, vars.reason),
    onSuccess: refreshAfterSuccess,
    onError: refreshListsAfterError,
  });

  const transition = useMutation({
    mutationFn: (vars: TransitionOrderVars) =>
      deps().orderApi.transitionOrder(sessionToken as string, vars.orderId, vars.toStatus, vars.reason),
    onSuccess: refreshAfterSuccess,
    onError: refreshListsAfterError,
  });

  const deliveryOutcome = useMutation({
    mutationFn: (vars: DeliveryOutcomeVars) =>
      deps().orderApi.recordDeliveryOutcome(
        sessionToken as string,
        vars.orderId,
        vars.outcome,
        vars.reason,
      ),
    onSuccess: refreshAfterSuccess,
    onError: refreshListsAfterError,
  });

  const error = useMemo(() => {
    const first = [cancel.error, transition.error, deliveryOutcome.error].find(Boolean);
    return (first as Error | null) ?? null;
  }, [cancel.error, transition.error, deliveryOutcome.error]);

  return {
    cancelOrder: async (vars) => {
      await cancel.mutateAsync(vars);
    },
    transitionOrder: async (vars) => {
      await transition.mutateAsync(vars);
    },
    recordDeliveryOutcome: async (vars) => {
      await deliveryOutcome.mutateAsync(vars);
    },
    isPending: cancel.isPending || transition.isPending || deliveryOutcome.isPending,
    error,
  };
}

import { useCallback, useEffect, useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { deps } from '../composition/container';
import { useCart } from './useCart';
import { cartItemKey, hasSelectedItems } from '../../domain/rules/cart-rules';
import {
  canCheckoutReconciled,
  hasUnavailableSelected,
  reconcileCart,
  type CartReconciliationResult,
  type ReconciledCartItem,
} from '../services/cart-reconciliation';
import type { CartItemRef } from '../read-models/cart';
import type { StorefrontStore } from '../read-models/storefront';

/** Стабильный пустой список (не пересоздаём в deps эффекта). */
const EMPTY_KEYS: string[] = [];

export type CartSelectionState = 'none' | 'some' | 'all';

export interface BuyerCartState {
  /** Отрендеренные позиции: локальный Cart + текущая публичная проекция. */
  items: ReconciledCartItem[];
  store: StorefrontStore | null;
  loading: boolean;
  /** Идёт пере-запрос/реконсиляция (оформление временно недоступно, docs/18 §22). */
  reconciling: boolean;
  error: string | null;
  /** Ключи ссылок, пропавших из витрины (эффект уже удалил их из Cart). */
  removedKeys: string[];
  storePaused: boolean;
  /** Есть сохранённые, но неоформляемые позиции (недостаток стока). */
  hasUnavailable: boolean;
  /** Есть выбранные, но неоформляемые позиции. */
  hasUnavailableSelected: boolean;
  /** Проекция успешно разрешилась (reconciliation не null); false → сеть/магазин. */
  resolved: boolean;
  /**
   * Показывать пустое состояние: локальных позиций нет **или** проекция
   * разрешилась без валидных позиций (все ссылки удалены). Не путать с ошибкой
   * проекции — та даёт `resolved = false` (docs/18 §10).
   */
  isEmpty: boolean;
  hasSelection: boolean;
  selectionState: CartSelectionState;
  /** Можно ли инициировать оформление прямо сейчас (docs/18 §22). */
  canCheckout: boolean;

  /** Выбрать/снять все оформляемые (orderable) позиции; неоформляемые не трогаем (docs/21 §3.7). */
  toggleAllOrderable: () => void;
  setSelectedByKeys: (keys: string[], selected: boolean) => void;
  toggleSelected: (productId: string, variantId: string | null) => void;
  updateQty: (productId: string, variantId: string | null, quantity: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  refresh: () => void;
}

/**
 * Application-абстракция вкладки Корзина (docs/18 §30). Объединяет локальное
 * состояние Cart (Zustand) с текущей публичной проекцией (`storefront_cart_items_read`),
 * реконсилирует устаревшие ссылки (удаляет пропавшие из витрины) и отдаёт готовые
 * к рендеру позиции + правила оформления. UI-логики здесь нет.
 *
 * `enabled=false` отключает запрос (напр. магазин на паузе) — позиции не удаляются.
 */
export function useBuyerCart(publicId: string | null, enabled = true): BuyerCartState {
  const cart = useCart();
  const {
    items,
    setSelectedByKeys,
    toggleSelected,
    updateQty,
    removeFromCart,
    removeByKeys,
  } = cart;

  const refs = useMemo<CartItemRef[]>(
    () => items.map((i) => ({ productId: i.productId, productVariantId: i.productVariantId })),
    [items],
  );

  const queryEnabled = Boolean(publicId) && refs.length > 0 && enabled;
  const query = useQuery({
    queryKey: ['buyer-cart', publicId, refs],
    queryFn: () => deps().cartRepository.loadCartItems(publicId as string, refs),
    enabled: queryEnabled,
    placeholderData: keepPreviousData,
  });

  const reconciliation = useMemo<CartReconciliationResult | null>(
    () => (query.data ? reconcileCart(items, query.data) : null),
    [items, query.data],
  );

  const removedKeys = reconciliation?.removedKeys ?? EMPTY_KEYS;

  // Реконсиляция устаревших ссылок: удаляем позиции, пропавшие из витрины (docs/18 §10).
  useEffect(() => {
    if (removedKeys.length > 0) removeByKeys(removedKeys);
  }, [removedKeys, removeByKeys]);

  // Распроданные выбранные позиции нельзя исправить количеством — снимаем выбор
  // автоматически, чтобы CTA не оставался заблокированным без пути решения (docs/18 §18).
  const soldOutSelectedKeys = useMemo(
    () =>
      (reconciliation?.items ?? [])
        .filter((entry) => entry.item.selected && entry.view.availableQuantity === 0)
        .map((entry) => cartItemKey(entry.item.productId, entry.item.productVariantId)),
    [reconciliation],
  );

  useEffect(() => {
    if (soldOutSelectedKeys.length > 0) setSelectedByKeys(soldOutSelectedKeys, false);
  }, [soldOutSelectedKeys, setSelectedByKeys]);

  const reconciling = queryEnabled && query.isFetching;

  // Выбор «все» считается по оформляемым позициям (docs/21 §3.7): неоформляемые
  // (недостаток стока) не выбираются автоматически и не блокируют семантику «Снять всё».
  const orderableEntries = useMemo(
    () => (reconciliation?.items ?? []).filter((entry) => entry.orderable),
    [reconciliation],
  );
  const orderableKeys = useMemo(
    () =>
      orderableEntries.map((entry) =>
        cartItemKey(entry.item.productId, entry.item.productVariantId),
      ),
    [orderableEntries],
  );
  const allOrderableSelected =
    orderableEntries.length > 0 && orderableEntries.every((entry) => entry.item.selected);
  const toggleAllOrderable = useCallback(() => {
    if (orderableKeys.length === 0) return;
    setSelectedByKeys(orderableKeys, !allOrderableSelected);
  }, [orderableKeys, allOrderableSelected, setSelectedByKeys]);

  const selectionState: CartSelectionState = allOrderableSelected
    ? 'all'
    : orderableEntries.some((entry) => entry.item.selected)
      ? 'some'
      : 'none';

  return {
    items: reconciliation?.items ?? [],
    store: reconciliation?.store ?? null,
    loading: queryEnabled && query.isLoading,
    reconciling,
    error: queryEnabled && query.isError ? (query.error as Error).message : null,
    removedKeys,
    storePaused: reconciliation?.storePaused ?? false,
    hasUnavailable: reconciliation?.hasUnavailable ?? false,
    hasUnavailableSelected: hasUnavailableSelected(reconciliation),
    resolved: reconciliation !== null,
    // Проекция удалила все ссылки → пустое состояние, а не экран ошибки, даже если
    // локальный Cart ещё не успел очиститься эффектом removeByKeys (docs/18 §10).
    isEmpty: items.length === 0 || reconciliation?.items.length === 0,
    hasSelection: hasSelectedItems(items),
    selectionState,
    canCheckout: canCheckoutReconciled(reconciliation) && !reconciling,
    toggleAllOrderable,
    setSelectedByKeys,
    toggleSelected,
    updateQty,
    remove: removeFromCart,
    refresh: () => {
      void query.refetch();
    },
  };
}

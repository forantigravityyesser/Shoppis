import type { CartItem } from '../../domain/models/cart';
import { cartItemKey } from '../../domain/rules/cart-rules';
import type {
  BuyerCartItem,
  CartItemProjection,
  CartItemView,
  CartReadResult,
} from '../read-models/cart';
import type { StorefrontStore } from '../read-models/storefront';

/**
 * Реконсиляция корзины (docs/18 §10): сопоставляет локальные позиции (`CartItem`)
 * с текущей публичной проекцией (`storefront_cart_items_read`).
 *
 * Чистая функция — без React/Zustand/InsForge, идемпотентна, ничего не мутирует
 * (не создаёт заказы, не резервирует и не меняет инвентарь). Возвращает, что
 * показывать и что удалить; применение к стору — ответственность вызывающего слоя.
 */

export interface ReconciledCartItem {
  /** Buy-side позиция: вариант гарантированно есть (см. `BuyerCartItem`). */
  item: BuyerCartItem;
  view: CartItemView;
  /** false — позиция сохранена, но сейчас не оформляется (сток меньше количества). */
  orderable: boolean;
}

export interface CartReconciliationResult {
  store: StorefrontStore;
  /** Позиции к отображению: ссылки разрешились в ACTIVE товар/вариант. */
  items: ReconciledCartItem[];
  /** Ключи позиций, пропавших из витрины (товар/вариант не ACTIVE) — удалить из Cart. */
  removedKeys: string[];
  /** true — есть сохранённые, но неоформляемые позиции (недостаток стока). */
  hasUnavailable: boolean;
  /** true — магазин на паузе: корзина читается, оформление запрещено. */
  storePaused: boolean;
}

function toView(proj: CartItemProjection, currencySymbol: string): CartItemView | null {
  if (!proj.productAvailable || !proj.variantAvailable) return null;
  // Позиция без варианта или без валидной цены не может быть оформлена → удаляется.
  if (proj.variantId === null || proj.unitPrice === null) return null;
  return {
    productId: proj.productId,
    productVariantId: proj.variantId,
    title: proj.title,
    imageUrl: proj.imageUrl,
    variantName: proj.variantName,
    variantValue: proj.variantValue,
    unitPrice: proj.unitPrice,
    currencySymbol,
    availableQuantity: proj.availableQuantity,
    productAvailable: true,
    variantAvailable: true,
  };
}

/**
 * Правила:
 *  - ссылка пропала из витрины (product/variant не ACTIVE) → `removedKeys`;
 *  - ссылка жива → позиция остаётся; `orderable=false`, если стока меньше количества;
 *  - магазин на паузе → позиции остаются, `storePaused=true`;
 *  - магазин не разрешён (`store === null`) → `null`: реконсиляцию не применяем,
 *    чтобы сетевая/конфиг-ошибка не стёрла корзину.
 * Порядок `items` и `removedKeys` — порядок входного `cartItems`.
 */
export function reconcileCart(
  cartItems: CartItem[],
  read: CartReadResult,
): CartReconciliationResult | null {
  if (!read.store) return null;

  const byKey = new Map(read.items.map((proj) => [cartItemKey(proj.productId, proj.variantId), proj]));

  const items: ReconciledCartItem[] = [];
  const removedKeys: string[] = [];

  for (const item of cartItems) {
    const proj = byKey.get(cartItemKey(item.productId, item.productVariantId));
    const view = proj ? toView(proj, read.store.currencySymbol) : null;
    if (!view) {
      removedKeys.push(cartItemKey(item.productId, item.productVariantId));
      continue;
    }
    items.push({
      // view разрешилась → variantId непустой; фиксируем non-null в buy-side модели.
      item: { ...item, productVariantId: view.productVariantId },
      view,
      orderable: view.availableQuantity >= item.quantity,
    });
  }

  return {
    store: read.store,
    items,
    removedKeys,
    hasUnavailable: items.some((entry) => !entry.orderable),
    storePaused: read.store.status === 'PAUSED',
  };
}

/**
 * Готова ли корзина к оформлению (docs/18 §22): магазин не на паузе, есть хотя бы
 * одна выбранная позиция и **все** выбранные позиции оформляемы (сток покрывает
 * количество). `null` (реконсиляция не выполнена) → false.
 */
export function canCheckoutReconciled(result: CartReconciliationResult | null): boolean {
  if (!result || result.storePaused) return false;
  const selected = result.items.filter((entry) => entry.item.selected);
  return selected.length > 0 && selected.every((entry) => entry.orderable);
}

/** Есть выбранные, но неоформляемые позиции (недостаток стока) — пометить/снять выбор. */
export function hasUnavailableSelected(result: CartReconciliationResult | null): boolean {
  if (!result) return false;
  return result.items.some((entry) => entry.item.selected && !entry.orderable);
}

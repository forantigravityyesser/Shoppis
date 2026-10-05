import { MAX_CART_QTY } from '../constants/limits';
import type { CartItem } from '../models/cart';
import type { RecipientInfo } from '../models/customer';

function activeItems(items: CartItem[]): CartItem[] {
  return items.filter(isSelectedForCheckout);
}

/**
 * Стабильный ключ позиции корзины: товар + вариант (учитывает `null`-вариант).
 * Одна формула для store-слайса и реконсиляции — чтобы «той же позицией» считалось
 * одно и то же везде (docs/18 §7).
 */
export function cartItemKey(productId: string, productVariantId: string | null): string {
  return `${productId}\u0000${productVariantId ?? ''}`;
}

/** Количество валидно: целое в диапазоне 1..MAX_CART_QTY (docs/18 §11). */
export function isValidCartQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_CART_QTY;
}

/** `+` доступен, если количество целое и меньше максимума. */
export function canIncrement(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity < MAX_CART_QTY;
}

/** `−` доступен, если количество целое и больше минимума. */
export function canDecrement(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 1;
}

/** Приводит количество к 1..MAX_CART_QTY; NaN → 1 (как в cart-slice). */
export function clampCartQuantity(quantity: number): number {
  if (Number.isNaN(quantity)) return 1;
  const floored = Math.floor(quantity);
  return Math.min(Math.max(floored, 1), MAX_CART_QTY);
}

/** Позиция включена в оформление: выбрана и с положительным количеством. */
export function isSelectedForCheckout(item: CartItem): boolean {
  return item.selected && item.quantity > 0;
}

/** Есть хотя бы одна позиция, включаемая в оформление. */
export function hasSelectedItems(items: CartItem[]): boolean {
  return items.some(isSelectedForCheckout);
}

/** Выбраны все позиции (и список не пуст). */
export function isAllSelected(items: CartItem[]): boolean {
  return items.length > 0 && items.every((i) => i.selected);
}

/** Выбрана часть, но не все позиции. */
export function isSomeSelected(items: CartItem[]): boolean {
  return !isAllSelected(items) && items.some((i) => i.selected);
}

/** Точная сумма выбранных товаров. Скидки уже сидят в price — без округлений. */
export function calcSubtotal(items: CartItem[]): number {
  return activeItems(items).reduce((sum, i) => sum + i.price * i.quantity, 0);
}

/** Итог равен сумме выбранных товаров */
export function calcTotal(items: CartItem[]): number {
  return calcSubtotal(items);
}

export function canCheckout(items: CartItem[], recipient: RecipientInfo): boolean {
  const active = activeItems(items);
  return (
    active.length > 0 &&
    active.every((i) => isValidCartQuantity(i.quantity)) &&
    recipient.name.trim().length > 0 &&
    recipient.phone.trim().length > 0 &&
    recipient.address.trim().length > 0
  );
}

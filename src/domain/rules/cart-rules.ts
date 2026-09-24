import { MAX_CART_QTY } from '../constants/limits';
import type { CartItem } from '../models/cart';
import type { RecipientInfo } from '../models/customer';

function activeItems(items: CartItem[]): CartItem[] {
  return items.filter((i) => i.selected && i.quantity > 0);
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
  const validItems = activeItems(items).every(
    (i) => Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= MAX_CART_QTY,
  );
  return (
    activeItems(items).length > 0 &&
    validItems &&
    recipient.name.trim().length > 0 &&
    recipient.phone.trim().length > 0 &&
    recipient.address.trim().length > 0
  );
}

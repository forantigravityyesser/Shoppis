// checkout-items.js — единая серверная валидация позиций checkout (docs/21 §3.3).
//
// Клиент недоверенный: количество ограничено 1..MAX_ITEM_QTY, дубли вариантов
// запрещены (клиент обязан слать нормализованную корзину). `MAX_ITEM_QTY` —
// зеркало доменного `MAX_CART_QTY` (src/domain/constants/limits.ts).

export const MAX_ITEM_QTY = 99;

/**
 * Валидирует и нормализует позиции checkout.
 * @param {unknown} rawItems
 * @returns {{ items: Array<{ variantId: string, quantity: number }> } | { error: string }}
 *   `error` — машинный код (EMPTY_CART | INVALID_CART_ITEM | INVALID_QUANTITY | VARIANT_DUPLICATE).
 */
export function validateCheckoutItems(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (!items.length) return { error: 'EMPTY_CART' };

  const seen = new Set();
  const normalized = [];
  for (const raw of items) {
    const variantId = String(raw?.variantId || '');
    const quantity = Number(raw?.quantity);
    if (!variantId) return { error: 'INVALID_CART_ITEM' };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QTY) {
      return { error: 'INVALID_QUANTITY' };
    }
    if (seen.has(variantId)) return { error: 'VARIANT_DUPLICATE' };
    seen.add(variantId);
    normalized.push({ variantId, quantity });
  }
  return { items: normalized };
}

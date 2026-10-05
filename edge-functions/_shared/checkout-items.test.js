import { describe, expect, it } from 'vitest';
import { MAX_ITEM_QTY, validateCheckoutItems } from './checkout-items.js';

describe('validateCheckoutItems (docs/21 §3.3)', () => {
  it('нормализует валидные позиции', () => {
    const result = validateCheckoutItems([
      { variantId: 'v1', quantity: 2 },
      { variantId: 'v2', quantity: 1 },
    ]);
    expect(result).toEqual({
      items: [
        { variantId: 'v1', quantity: 2 },
        { variantId: 'v2', quantity: 1 },
      ],
    });
  });

  it('пустой список → EMPTY_CART', () => {
    expect(validateCheckoutItems([])).toEqual({ error: 'EMPTY_CART' });
    expect(validateCheckoutItems(null)).toEqual({ error: 'EMPTY_CART' });
  });

  it('отсутствующий вариант → INVALID_CART_ITEM', () => {
    expect(validateCheckoutItems([{ variantId: '', quantity: 1 }])).toEqual({
      error: 'INVALID_CART_ITEM',
    });
  });

  it('количество вне 1..99 / нецелое → INVALID_QUANTITY', () => {
    for (const quantity of [0, -1, MAX_ITEM_QTY + 1, 1.5, Number.NaN]) {
      expect(validateCheckoutItems([{ variantId: 'v1', quantity }])).toEqual({
        error: 'INVALID_QUANTITY',
      });
    }
  });

  it('границы включаются: 1 и 99 допустимы', () => {
    expect(validateCheckoutItems([{ variantId: 'v1', quantity: 1 }])).toEqual({
      items: [{ variantId: 'v1', quantity: 1 }],
    });
    expect(validateCheckoutItems([{ variantId: 'v1', quantity: MAX_ITEM_QTY }])).toEqual({
      items: [{ variantId: 'v1', quantity: MAX_ITEM_QTY }],
    });
  });

  it('дубль варианта → VARIANT_DUPLICATE', () => {
    expect(
      validateCheckoutItems([
        { variantId: 'v1', quantity: 50 },
        { variantId: 'v1', quantity: 50 },
      ]),
    ).toEqual({ error: 'VARIANT_DUPLICATE' });
  });
});

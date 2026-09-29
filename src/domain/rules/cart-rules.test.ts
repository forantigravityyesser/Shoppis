import { describe, expect, it } from 'vitest';
import { calcSubtotal, calcTotal, canCheckout } from './cart-rules';
import { MAX_CART_QTY } from '../constants/limits';
import type { CartItem } from '../models/cart';
import type { RecipientInfo } from '../models/customer';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 'p1',
    productVariantId: 'v1',
    quantity: 1,
    price: 1000,
    selected: true,
    ...overrides,
  };
}

const validRecipient: RecipientInfo = { name: 'Иван', phone: '+7900', address: 'Москва' };

describe('calcSubtotal', () => {
  it('sums selected items only', () => {
    const items = [
      makeItem({ price: 1000, quantity: 2 }),
      makeItem({ price: 500, quantity: 1, selected: false }),
      makeItem({ price: 300, quantity: 3 }),
    ];
    expect(calcSubtotal(items)).toBe(2900);
    expect(calcTotal(items)).toBe(2900);
  });

  it('ignores non-positive quantities', () => {
    expect(calcSubtotal([makeItem({ quantity: 0 }), makeItem({ quantity: -2 })])).toBe(0);
  });
});

describe('canCheckout', () => {
  it('accepts a valid selected item with recipient', () => {
    expect(canCheckout([makeItem()], validRecipient)).toBe(true);
  });

  it('rejects an empty selection', () => {
    expect(canCheckout([], validRecipient)).toBe(false);
    expect(canCheckout([makeItem({ selected: false })], validRecipient)).toBe(false);
  });

  it('rejects invalid quantities', () => {
    expect(canCheckout([makeItem({ quantity: 0 })], validRecipient)).toBe(false);
    expect(canCheckout([makeItem({ quantity: MAX_CART_QTY + 1 })], validRecipient)).toBe(false);
    expect(canCheckout([makeItem({ quantity: 1.5 })], validRecipient)).toBe(false);
  });

  it('requires recipient name, phone and address', () => {
    expect(canCheckout([makeItem()], { ...validRecipient, name: '  ' })).toBe(false);
    expect(canCheckout([makeItem()], { ...validRecipient, phone: '' })).toBe(false);
    expect(canCheckout([makeItem()], { ...validRecipient, address: '' })).toBe(false);
  });
});

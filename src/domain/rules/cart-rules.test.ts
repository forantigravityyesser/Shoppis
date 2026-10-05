import { describe, expect, it } from 'vitest';
import {
  calcSubtotal,
  calcTotal,
  canCheckoutCart,
  canDecrement,
  canIncrement,
  clampCartQuantity,
  cartItemKey,
  hasSelectedItems,
  isAllSelected,
  isSomeSelected,
  isSelectedForCheckout,
  isValidCartQuantity,
} from './cart-rules';
import { MAX_CART_QTY } from '../constants/limits';
import type { CartItem } from '../models/cart';

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

describe('quantity boundaries', () => {
  it('isValidCartQuantity: целое 1..99', () => {
    expect(isValidCartQuantity(1)).toBe(true);
    expect(isValidCartQuantity(MAX_CART_QTY)).toBe(true);
    expect(isValidCartQuantity(0)).toBe(false);
    expect(isValidCartQuantity(MAX_CART_QTY + 1)).toBe(false);
    expect(isValidCartQuantity(1.5)).toBe(false);
    expect(isValidCartQuantity(Number.NaN)).toBe(false);
  });

  it('canIncrement / canDecrement по границам', () => {
    expect(canIncrement(1)).toBe(true);
    expect(canIncrement(MAX_CART_QTY)).toBe(false);
    expect(canDecrement(2)).toBe(true);
    expect(canDecrement(1)).toBe(false);
  });

  it('clampCartQuantity приводит к 1..99, NaN → 1', () => {
    expect(clampCartQuantity(0)).toBe(1);
    expect(clampCartQuantity(-5)).toBe(1);
    expect(clampCartQuantity(2.9)).toBe(2);
    expect(clampCartQuantity(MAX_CART_QTY + 100)).toBe(MAX_CART_QTY);
    expect(clampCartQuantity(Number.NaN)).toBe(1);
    expect(clampCartQuantity(Number.POSITIVE_INFINITY)).toBe(MAX_CART_QTY);
  });
});

describe('selection rules', () => {
  it('isSelectedForCheckout требует selected и quantity > 0', () => {
    expect(isSelectedForCheckout(makeItem())).toBe(true);
    expect(isSelectedForCheckout(makeItem({ selected: false }))).toBe(false);
    expect(isSelectedForCheckout(makeItem({ quantity: 0 }))).toBe(false);
  });

  it('hasSelectedItems / isAllSelected / isSomeSelected', () => {
    const a = makeItem({ productId: 'a', productVariantId: 'a1' });
    const b = makeItem({ productId: 'b', productVariantId: 'b1' });
    expect(hasSelectedItems([])).toBe(false);
    expect(hasSelectedItems([a, b])).toBe(true);
    expect(hasSelectedItems([{ ...a, selected: false }])).toBe(false);

    expect(isAllSelected([])).toBe(false);
    expect(isAllSelected([a, b])).toBe(true);
    expect(isAllSelected([a, { ...b, selected: false }])).toBe(false);

    expect(isSomeSelected([a, { ...b, selected: false }])).toBe(true);
    expect(isSomeSelected([a, b])).toBe(false);
    expect(isSomeSelected([{ ...a, selected: false }])).toBe(false);
  });
});

describe('cartItemKey', () => {
  it('различает варианты и товары', () => {
    expect(cartItemKey('p1', 'v1')).not.toBe(cartItemKey('p1', 'v2'));
    expect(cartItemKey('p1', 'v1')).not.toBe(cartItemKey('p2', 'v1'));
  });

  it('стабилен для одинаковых ссылок, включая null-вариант', () => {
    expect(cartItemKey('p1', 'v1')).toBe(cartItemKey('p1', 'v1'));
    expect(cartItemKey('p1', null)).toBe(cartItemKey('p1', null));
    expect(cartItemKey('p1', null)).not.toBe(cartItemKey('p1', 'v1'));
  });
});

describe('canCheckoutCart', () => {
  it('принимает валидную выбранную позицию', () => {
    expect(canCheckoutCart([makeItem()])).toBe(true);
  });

  it('отклоняет пустой выбор', () => {
    expect(canCheckoutCart([])).toBe(false);
    expect(canCheckoutCart([makeItem({ selected: false })])).toBe(false);
  });

  it('отклоняет невалидные количества', () => {
    expect(canCheckoutCart([makeItem({ quantity: 0 })])).toBe(false);
    expect(canCheckoutCart([makeItem({ quantity: MAX_CART_QTY + 1 })])).toBe(false);
    expect(canCheckoutCart([makeItem({ quantity: 1.5 })])).toBe(false);
  });

  it('не зависит от получателя (это checkout-rules)', () => {
    expect(canCheckoutCart([makeItem()])).toBe(true);
  });
});

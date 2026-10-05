import { describe, expect, it } from 'vitest';
import { canCheckoutReconciled, hasUnavailableSelected, reconcileCart } from './cart-reconciliation';
import { cartItemKey } from '../../domain/rules/cart-rules';
import type { CartItem } from '../../domain/models/cart';
import type { CartItemProjection, CartReadResult } from '../read-models/cart';
import type { StorefrontStore } from '../read-models/storefront';

const STORE: StorefrontStore = {
  id: 's1',
  publicId: 'pub1',
  name: 'Shop',
  bannerUrl: null,
  status: 'ACTIVE',
  currencyCode: 'USD',
  currencySymbol: '$',
};

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 'p1',
    productVariantId: 'v1',
    quantity: 2,
    price: 1000,
    selected: true,
    ...overrides,
  };
}

function makeProjection(overrides: Partial<CartItemProjection> = {}): CartItemProjection {
  return {
    productId: 'p1',
    variantId: 'v1',
    productAvailable: true,
    variantAvailable: true,
    title: 'Nike Air Max',
    imageUrl: 'https://img/thumb.jpg',
    variantName: 'Size',
    variantValue: '42',
    unitPrice: 12000,
    availableQuantity: 5,
    ...overrides,
  };
}

function read(store: StorefrontStore | null, items: CartItemProjection[]): CartReadResult {
  return { store, items };
}

describe('reconcileCart', () => {
  it('store === null → null (реконсиляцию не применяем)', () => {
    expect(reconcileCart([makeItem()], read(null, []))).toBeNull();
  });

  it('разрешившаяся позиция попадает в items с текущей ценой/наличием', () => {
    const result = reconcileCart([makeItem({ quantity: 2 })], read(STORE, [makeProjection()]));
    expect(result?.removedKeys).toEqual([]);
    expect(result?.hasUnavailable).toBe(false);
    expect(result?.storePaused).toBe(false);
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0].orderable).toBe(true);
    expect(result?.items[0].view).toEqual({
      productId: 'p1',
      productVariantId: 'v1',
      title: 'Nike Air Max',
      imageUrl: 'https://img/thumb.jpg',
      variantName: 'Size',
      variantValue: '42',
      unitPrice: 12000,
      currencySymbol: '$',
      availableQuantity: 5,
      productAvailable: true,
      variantAvailable: true,
    });
  });

  it('недостаточный сток → позиция остаётся, но не оформляется', () => {
    const result = reconcileCart(
      [makeItem({ quantity: 5 })],
      read(STORE, [makeProjection({ availableQuantity: 2 })]),
    );
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0].orderable).toBe(false);
    expect(result?.hasUnavailable).toBe(true);
    expect(result?.removedKeys).toEqual([]);
  });

  it('пропавший товар/вариант → removedKeys, в items не попадает', () => {
    const item = makeItem();
    const result = reconcileCart([item], read(STORE, []));
    expect(result?.items).toEqual([]);
    expect(result?.removedKeys).toEqual([cartItemKey('p1', 'v1')]);
  });

  it('productAvailable=false или variantAvailable=false → удаление', () => {
    const removed = reconcileCart(
      [makeItem()],
      read(STORE, [makeProjection({ productAvailable: false })]),
    );
    expect(removed?.removedKeys).toHaveLength(1);

    const removedVariant = reconcileCart(
      [makeItem()],
      read(STORE, [makeProjection({ variantAvailable: false })]),
    );
    expect(removedVariant?.removedKeys).toHaveLength(1);
  });

  it('нулевой вариант или null-цена → удаление (неоформляемая ссылка)', () => {
    expect(
      reconcileCart([makeItem()], read(STORE, [makeProjection({ variantId: null })])),
    ).toMatchObject({ items: [], removedKeys: [cartItemKey('p1', 'v1')] });
    expect(
      reconcileCart([makeItem()], read(STORE, [makeProjection({ unitPrice: null })])),
    ).toMatchObject({ items: [], removedKeys: [cartItemKey('p1', 'v1')] });
  });

  it('позиция без варианта (productVariantId=null) удаляется', () => {
    const item = makeItem({ productVariantId: null });
    const result = reconcileCart([item], read(STORE, [makeProjection()]));
    expect(result?.items).toEqual([]);
    expect(result?.removedKeys).toEqual([cartItemKey('p1', null)]);
  });

  it('PAUSED магазин → позиции читаются, storePaused=true', () => {
    const result = reconcileCart(
      [makeItem()],
      read({ ...STORE, status: 'PAUSED' }, [makeProjection()]),
    );
    expect(result?.storePaused).toBe(true);
    expect(result?.items).toHaveLength(1);
    expect(result?.removedKeys).toEqual([]);
  });

  it('canCheckoutReconciled: выбирает/блокирует по стокам, паузе и пустому выбору', () => {
    expect(canCheckoutReconciled(null)).toBe(false);

    const ok = reconcileCart([makeItem({ selected: true })], read(STORE, [makeProjection()]));
    expect(canCheckoutReconciled(ok)).toBe(true);

    const none = reconcileCart([makeItem({ selected: false })], read(STORE, [makeProjection()]));
    expect(canCheckoutReconciled(none)).toBe(false);

    const lowStock = reconcileCart(
      [makeItem({ selected: true, quantity: 9 })],
      read(STORE, [makeProjection({ availableQuantity: 2 })]),
    );
    expect(canCheckoutReconciled(lowStock)).toBe(false);

    const paused = reconcileCart(
      [makeItem({ selected: true })],
      read({ ...STORE, status: 'PAUSED' }, [makeProjection()]),
    );
    expect(canCheckoutReconciled(paused)).toBe(false);
  });

  it('hasUnavailableSelected: только выбранные неоформляемые позиции', () => {
    const selectedLow = reconcileCart(
      [makeItem({ selected: true, quantity: 9 })],
      read(STORE, [makeProjection({ availableQuantity: 2 })]),
    );
    expect(hasUnavailableSelected(selectedLow)).toBe(true);

    const unselectedLow = reconcileCart(
      [makeItem({ selected: false, quantity: 9 })],
      read(STORE, [makeProjection({ availableQuantity: 2 })]),
    );
    expect(hasUnavailableSelected(unselectedLow)).toBe(false);

    expect(hasUnavailableSelected(null)).toBe(false);
  });

  it('сохраняет порядок позиций и removedKeys; лишние проекции игнорирует', () => {
    const cart = [
      makeItem({ productId: 'a', productVariantId: 'a1' }),
      makeItem({ productId: 'b', productVariantId: 'b1' }),
      makeItem({ productId: 'c', productVariantId: 'c1' }),
    ];
    const projection = [
      makeProjection({ productId: 'b', variantId: 'b1' }),
      makeProjection({ productId: 'x', variantId: 'x1' }),
      makeProjection({ productId: 'a', variantId: 'a1' }),
    ];
    const result = reconcileCart(cart, read(STORE, projection));
    expect(result?.items.map((entry) => entry.view.productId)).toEqual(['a', 'b']);
    expect(result?.removedKeys).toEqual([cartItemKey('c', 'c1')]);
  });
});

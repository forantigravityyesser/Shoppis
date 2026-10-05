// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Store construction reads the app language through deps(); only i18n is needed here.
vi.mock('../../composition/container', () => ({
  deps: () => ({ i18n: { getAppLanguage: () => 'ru', setAppLanguage: () => {} } }),
}));

import { useStore } from '../index';
import { cartItemKey } from '../../../domain/rules/cart-rules';
import { MAX_CART_QTY, MAX_CART_ITEMS } from '../../../domain/constants/limits';

function reset(storeId: string | null = 'store-a') {
  useStore.setState({ cartByStore: {}, storeId });
}

function itemsOf(storeId = 'store-a') {
  return useStore.getState().cartByStore[storeId] ?? [];
}

function add(productId: string, variantId: string | null, quantity = 1, storeId = 'store-a') {
  useStore.setState({ storeId });
  useStore.getState().addToCart({ productId, productVariantId: variantId, price: 1000, quantity });
}

beforeEach(() => reset());

describe('cart-slice', () => {
  it('addToCart: добавляет selected=true и клампит количество', () => {
    add('p1', 'v1', 200);
    expect(itemsOf()).toHaveLength(1);
    expect(itemsOf()[0]).toMatchObject({ productId: 'p1', quantity: MAX_CART_QTY, selected: true });
  });

  it('addToCart: одна ссылка мерджится и clamp-суммируется, selected снова true', () => {
    add('p1', 'v1', 2);
    useStore.getState().toggleSelected('p1', 'v1');
    add('p1', 'v1', 3);
    expect(itemsOf()).toHaveLength(1);
    expect(itemsOf()[0]).toMatchObject({ quantity: 5, selected: true });
  });

  it('updateQty клампит к 1..99, не трогая другие позиции', () => {
    add('p1', 'v1', 1);
    add('p2', 'v2', 1);
    useStore.getState().updateQty('p1', 'v1', 0);
    expect(itemsOf().find((i) => i.productId === 'p1')?.quantity).toBe(1);
    useStore.getState().updateQty('p2', 'v2', 500);
    expect(itemsOf().find((i) => i.productId === 'p2')?.quantity).toBe(MAX_CART_QTY);
  });

  it('setAllSelected проставляет/снимает выбор у всех', () => {
    add('p1', 'v1');
    add('p2', 'v2');
    useStore.getState().setAllSelected(false);
    expect(itemsOf().every((i) => !i.selected)).toBe(true);
    useStore.getState().setAllSelected(true);
    expect(itemsOf().every((i) => i.selected)).toBe(true);
  });

  it('setSelectedByKeys меняет только адресные ключи', () => {
    add('p1', 'v1');
    add('p2', 'v2');
    useStore.getState().setSelectedByKeys([cartItemKey('p2', 'v2')], false);
    expect(itemsOf().find((i) => i.productId === 'p1')?.selected).toBe(true);
    expect(itemsOf().find((i) => i.productId === 'p2')?.selected).toBe(false);
  });

  it('addToCart: не добавляет новую строку сверх MAX_CART_ITEMS, но мерджит существующую', () => {
    for (let i = 0; i < MAX_CART_ITEMS; i += 1) add(`p${i}`, `v${i}`);
    expect(itemsOf()).toHaveLength(MAX_CART_ITEMS);

    add('overflow', 'v');
    expect(itemsOf()).toHaveLength(MAX_CART_ITEMS);

    add('p0', 'v0', 1);
    expect(itemsOf()).toHaveLength(MAX_CART_ITEMS);
    expect(itemsOf()[0]).toMatchObject({ productId: 'p0', quantity: 2 });
  });

  it('removeByKeys удаляет только адресные ключи', () => {
    add('p1', 'v1');
    add('p2', 'v2');
    useStore.getState().removeByKeys([cartItemKey('p1', 'v1')]);
    expect(itemsOf().map((i) => i.productId)).toEqual(['p2']);
  });

  it('изоляция витрин: операции одной не трогают другую', () => {
    add('p1', 'v1', 1, 'store-a');
    add('p2', 'v2', 1, 'store-b');

    useStore.setState({ storeId: 'store-a' });
    useStore.getState().setAllSelected(false);
    useStore.getState().removeByKeys([cartItemKey('p1', 'v1')]);

    expect(itemsOf('store-a')).toHaveLength(0);
    expect(itemsOf('store-b')).toHaveLength(1);
    expect(itemsOf('store-b')[0].selected).toBe(true);
  });

  it('clearCart очищает только текущую витрину', () => {
    add('p1', 'v1', 1, 'store-a');
    add('p2', 'v2', 1, 'store-b');
    useStore.setState({ storeId: 'store-a' });
    useStore.getState().clearCart();
    expect(itemsOf('store-a')).toHaveLength(0);
    expect(itemsOf('store-b')).toHaveLength(1);
  });
});

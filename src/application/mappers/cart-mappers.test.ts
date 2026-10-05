import { describe, expect, it } from 'vitest';
import { mapStorefrontCartItems } from './cart-mappers';

const STORE = {
  id: 's1',
  publicId: 'pub1',
  name: 'Shop',
  status: 'ACTIVE',
  currencyCode: 'USD',
  currencySymbol: '$',
};

function item(overrides: Record<string, unknown> = {}) {
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

describe('mapStorefrontCartItems', () => {
  it('маппит магазин и позиции', () => {
    const result = mapStorefrontCartItems({ store: STORE, items: [item()] });
    expect(result?.store?.id).toBe('s1');
    expect(result?.store?.currencySymbol).toBe('$');
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]).toMatchObject({
      productId: 'p1',
      variantId: 'v1',
      productAvailable: true,
      variantAvailable: true,
      unitPrice: 12000,
      availableQuantity: 5,
    });
  });

  it('null/битый магазин → null (проекция невалидна)', () => {
    expect(mapStorefrontCartItems(null)).toBeNull();
    expect(mapStorefrontCartItems({ items: [] })).toBeNull();
    expect(mapStorefrontCartItems({ store: { id: '', publicId: '' } })).toBeNull();
  });

  it('недоступная ссылка сохраняется с флагами false и null-ценой', () => {
    const result = mapStorefrontCartItems({
      store: STORE,
      items: [
        item({ productAvailable: false, variantAvailable: false, unitPrice: null, title: '', imageUrl: null }),
      ],
    });
    expect(result?.items[0]).toMatchObject({
      productAvailable: false,
      variantAvailable: false,
      unitPrice: null,
      imageUrl: null,
    });
  });

  it('elements без productId отбрасываются; не-массив items → []', () => {
    const result = mapStorefrontCartItems({
      store: STORE,
      items: [{ variantId: 'v1' }, item(), 'garbage'],
    });
    expect(result?.items).toHaveLength(1);
    expect(mapStorefrontCartItems({ store: STORE, items: 'nope' })?.items).toEqual([]);
  });

  it('numeric-строки цен/количеств принимаются; отрицательные → null/0', () => {
    const result = mapStorefrontCartItems({
      store: STORE,
      items: [item({ unitPrice: '12000', availableQuantity: '3' }), item({ productId: 'p2', unitPrice: -5, availableQuantity: -1 })],
    });
    expect(result?.items[0]).toMatchObject({ unitPrice: 12000, availableQuantity: 3 });
    expect(result?.items[1]).toMatchObject({ unitPrice: null, availableQuantity: 0 });
  });

  it('variantId null остаётся null; недоступные строки флагов → false', () => {
    const result = mapStorefrontCartItems({
      store: STORE,
      items: [item({ variantId: null, variantAvailable: 'yes', productAvailable: 1 })],
    });
    expect(result?.items[0]).toMatchObject({
      variantId: null,
      variantAvailable: false,
      productAvailable: false,
    });
  });
});

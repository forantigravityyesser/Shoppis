import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../insforge/client', () => ({ insforge: { database: { rpc } } }));

import { loadCartItems } from './cart-repository';

const STORE = {
  id: 's1',
  publicId: 'pub1',
  name: 'Shop',
  status: 'ACTIVE',
  currencyCode: 'USD',
  currencySymbol: '$',
};

const PROJECTION = {
  store: STORE,
  items: [
    {
      productId: 'p1',
      variantId: 'v1',
      productAvailable: true,
      variantAvailable: true,
      title: 'T-Shirt',
      imageUrl: null,
      variantName: 'Size',
      variantValue: 'M',
      unitPrice: 249000,
      availableQuantity: 5,
    },
  ],
};

beforeEach(() => rpc.mockReset());

describe('loadCartItems', () => {
  it('не ходит в сеть без public_id', async () => {
    const result = await loadCartItems('', [{ productId: 'p1', productVariantId: 'v1' }]);
    expect(result).toEqual({ store: null, items: [] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('не ходит в сеть без ссылок', async () => {
    const result = await loadCartItems('pub1', []);
    expect(result).toEqual({ store: null, items: [] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('вызывает rpc с refs и маппит проекцию', async () => {
    rpc.mockResolvedValue({ data: PROJECTION, error: null });

    const result = await loadCartItems('pub1', [{ productId: 'p1', productVariantId: 'v1' }]);

    expect(rpc).toHaveBeenCalledWith('storefront_cart_items_read', {
      p_public_id: 'pub1',
      p_items: [{ productId: 'p1', variantId: 'v1' }],
    });
    expect(result.store?.id).toBe('s1');
    expect(result.items[0]).toMatchObject({ productId: 'p1', unitPrice: 249000 });
  });

  it('null-вариант уходит как variantId: null', async () => {
    rpc.mockResolvedValue({ data: { store: STORE, items: [] }, error: null });

    await loadCartItems('pub1', [{ productId: 'p1', productVariantId: null }]);

    expect(rpc).toHaveBeenCalledWith('storefront_cart_items_read', {
      p_public_id: 'pub1',
      p_items: [{ productId: 'p1', variantId: null }],
    });
  });

  it('null data (магазин не найден) → пустой результат', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadCartItems('pub1', [{ productId: 'p1', productVariantId: 'v1' }])).toEqual({
      store: null,
      items: [],
    });
  });

  it('бросает ошибку транспорта', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(
      loadCartItems('pub1', [{ productId: 'p1', productVariantId: 'v1' }]),
    ).rejects.toThrow('boom');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../insforge/client', () => ({ insforge: { database: { rpc } } }));

import { loadCatalogPriceBounds, loadCatalogProducts } from './storefront-catalog-repository';

const PAGE = {
  products: [
    {
      id: 'p1',
      title: 'T-Shirt',
      categoryId: null,
      imageUrl: null,
      price: 249000,
      available: true,
    },
  ],
  nextCursor: '1790797824125169:f2dbdb71-a1c7-4c49-8164-75f6a3fd73dc',
};

const BOUNDS = { minPrice: 8000, maxPrice: 320000 };

beforeEach(() => rpc.mockReset());

describe('loadCatalogProducts', () => {
  it('не ходит в сеть без public_id', async () => {
    expect(await loadCatalogProducts({ publicId: '', limit: 12 })).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('вызывает rpc storefront_catalog_products_read со всеми фильтрами и маппит страницу', async () => {
    rpc.mockResolvedValue({ data: PAGE, error: null });

    const page = await loadCatalogProducts({
      publicId: 'pub1',
      limit: 12,
      categoryId: 'cat-1',
      search: 'nike',
      minPrice: 5000,
      maxPrice: 20000,
      cursor: 'cur-1',
    });

    expect(rpc).toHaveBeenCalledWith('storefront_catalog_products_read', {
      p_public_id: 'pub1',
      p_category_id: 'cat-1',
      p_search: 'nike',
      p_min_price: 5000,
      p_max_price: 20000,
      p_cursor: 'cur-1',
      p_limit: 12,
    });
    expect(page?.products).toHaveLength(1);
    expect(page?.nextCursor).toBe(PAGE.nextCursor);
  });

  it('незаданные фильтры уходят как null (первая страница)', async () => {
    rpc.mockResolvedValue({ data: { products: [], nextCursor: null }, error: null });

    await loadCatalogProducts({ publicId: 'pub1', limit: 24 });

    expect(rpc).toHaveBeenCalledWith('storefront_catalog_products_read', {
      p_public_id: 'pub1',
      p_category_id: null,
      p_search: null,
      p_min_price: null,
      p_max_price: null,
      p_cursor: null,
      p_limit: 24,
    });
  });

  it('null data → null (магазин не найден)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadCatalogProducts({ publicId: 'missing', limit: 12 })).toBeNull();
  });

  it('бросает ошибку транспорта', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(loadCatalogProducts({ publicId: 'pub1', limit: 12 })).rejects.toThrow('boom');
  });
});

describe('loadCatalogPriceBounds', () => {
  it('не ходит в сеть без public_id', async () => {
    expect(await loadCatalogPriceBounds('')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('вызывает rpc и маппит границы', async () => {
    rpc.mockResolvedValue({ data: BOUNDS, error: null });

    expect(await loadCatalogPriceBounds('pub1')).toEqual(BOUNDS);
    expect(rpc).toHaveBeenCalledWith('storefront_catalog_price_bounds_read', {
      p_public_id: 'pub1',
    });
  });

  it('пустой магазин → null-границы', async () => {
    rpc.mockResolvedValue({ data: { minPrice: null, maxPrice: null }, error: null });
    expect(await loadCatalogPriceBounds('pub1')).toEqual({ minPrice: null, maxPrice: null });
  });

  it('null data → null (магазин не найден)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadCatalogPriceBounds('missing')).toBeNull();
  });

  it('бросает ошибку транспорта', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(loadCatalogPriceBounds('pub1')).rejects.toThrow('boom');
  });
});

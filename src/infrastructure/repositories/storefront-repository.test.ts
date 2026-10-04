import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../insforge/client', () => ({ insforge: { database: { rpc } } }));

import {
  loadPublicStoreContext,
  loadStorefrontHome,
  loadStorefrontHomeProducts,
} from './storefront-repository';

const HOME = {
  store: {
    id: 's1',
    publicId: 'pub1',
    name: 'Nike',
    bannerUrl: null,
    status: 'ACTIVE',
    currencyCode: 'USD',
    currencySymbol: '$',
  },
  categories: [],
};

const PRODUCT_PAGE = {
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

const CONTEXT = {
  id: 's1',
  publicId: 'pub1',
  name: 'Nike',
  status: 'ACTIVE',
  supportHandle: 'john',
  logoUrl: null,
};

beforeEach(() => rpc.mockReset());

describe('loadStorefrontHome', () => {
  it('не ходит в сеть без public_id', async () => {
    expect(await loadStorefrontHome('')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('вызывает rpc storefront_home_context_read и маппит store+categories', async () => {
    rpc.mockResolvedValue({ data: HOME, error: null });

    const home = await loadStorefrontHome('pub1');

    expect(rpc).toHaveBeenCalledWith('storefront_home_context_read', { p_public_id: 'pub1' });
    expect(home?.store.publicId).toBe('pub1');
    expect(home?.categories).toEqual([]);
  });

  it('null data → null (магазин не найден), без исключения', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadStorefrontHome('missing')).toBeNull();
  });

  it('бросает ошибку транспорта', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(loadStorefrontHome('pub1')).rejects.toThrow('boom');
  });

  it('некорректный ответ → null', async () => {
    rpc.mockResolvedValue({ data: { foo: 'bar' }, error: null });
    expect(await loadStorefrontHome('pub1')).toBeNull();
  });
});

describe('loadStorefrontHomeProducts', () => {
  it('не ходит в сеть без public_id', async () => {
    expect(await loadStorefrontHomeProducts('', null, 6)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('вызывает rpc с cursor и limit, маппит страницу', async () => {
    rpc.mockResolvedValue({ data: PRODUCT_PAGE, error: null });

    const page = await loadStorefrontHomeProducts('pub1', 'cursor-x', 6);

    expect(rpc).toHaveBeenCalledWith('storefront_home_products_read', {
      p_public_id: 'pub1',
      p_cursor: 'cursor-x',
      p_limit: 6,
    });
    expect(page?.products).toHaveLength(1);
    expect(page?.nextCursor).toBe(PRODUCT_PAGE.nextCursor);
  });

  it('null data → null (магазин не найден)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadStorefrontHomeProducts('missing', null, 6)).toBeNull();
  });

  it('бросает ошибку транспорта', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(loadStorefrontHomeProducts('pub1', null, 6)).rejects.toThrow('boom');
  });
});

describe('loadPublicStoreContext', () => {
  it('не ходит в сеть без ссылки', async () => {
    expect(await loadPublicStoreContext('')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('вызывает rpc storefront_public_context_read и маппит минимальную проекцию', async () => {
    rpc.mockResolvedValue({ data: CONTEXT, error: null });

    const context = await loadPublicStoreContext('pub1');

    expect(rpc).toHaveBeenCalledWith('storefront_public_context_read', { p_store_ref: 'pub1' });
    expect(context).toEqual(CONTEXT);
  });

  it('null data → null (магазин не найден), без исключения', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadPublicStoreContext('missing')).toBeNull();
  });

  it('некорректный ответ → null', async () => {
    rpc.mockResolvedValue({ data: { name: 'no ids' }, error: null });
    expect(await loadPublicStoreContext('pub1')).toBeNull();
  });

  it('бросает ошибку транспорта', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(loadPublicStoreContext('pub1')).rejects.toThrow('boom');
  });
});

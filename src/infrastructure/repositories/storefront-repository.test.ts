import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../insforge/client', () => ({ insforge: { database: { rpc } } }));

import { loadStorefrontHome } from './storefront-repository';

const HOME = {
  store: {
    id: 's1',
    publicId: 'pub1',
    name: 'Nike',
    bannerUrl: null,
    sellerAvatarUrl: null,
    status: 'ACTIVE',
    currencyCode: 'USD',
    currencySymbol: '$',
  },
  categories: [],
  products: [],
};

beforeEach(() => rpc.mockReset());

describe('loadStorefrontHome', () => {
  it('не ходит в сеть без public_id', async () => {
    expect(await loadStorefrontHome('')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('вызывает rpc storefront_home_read и маппит ответ', async () => {
    rpc.mockResolvedValue({ data: HOME, error: null });

    const home = await loadStorefrontHome('pub1');

    expect(rpc).toHaveBeenCalledWith('storefront_home_read', { p_public_id: 'pub1' });
    expect(home?.store.publicId).toBe('pub1');
    expect(home?.store.name).toBe('Nike');
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

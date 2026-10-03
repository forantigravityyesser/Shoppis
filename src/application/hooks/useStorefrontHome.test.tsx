// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { loadStorefrontHome } = vi.hoisted(() => ({ loadStorefrontHome: vi.fn() }));

vi.mock('../composition/container', () => ({
  deps: () => ({ storefrontRepository: { loadStorefrontHome } }),
}));

import { useStorefrontHome } from './useStorefrontHome';
import type { StorefrontHome } from '../read-models/storefront';

const HOME: StorefrontHome = {
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

let client: QueryClient;

beforeEach(() => {
  loadStorefrontHome.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useStorefrontHome', () => {
  it('без publicId не ходит в сеть и не считается loading/notFound', () => {
    const { result } = renderHook(() => useStorefrontHome(null), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.home).toBeNull();
    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toBeNull();
    expect(loadStorefrontHome).not.toHaveBeenCalled();
  });

  it('загружает витрину и снимает loading', async () => {
    loadStorefrontHome.mockResolvedValue(HOME);

    const { result } = renderHook(() => useStorefrontHome('pub1'), { wrapper });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.home?.store.publicId).toBe('pub1');
    expect(result.current.notFound).toBe(false);
    expect(loadStorefrontHome).toHaveBeenCalledWith('pub1');
  });

  it('null-ответ → notFound', async () => {
    loadStorefrontHome.mockResolvedValue(null);

    const { result } = renderHook(() => useStorefrontHome('missing'), { wrapper });

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.home).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('ошибка → error, без notFound', async () => {
    loadStorefrontHome.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useStorefrontHome('pub1'), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.notFound).toBe(false);
    expect(result.current.loading).toBe(false);
  });
});

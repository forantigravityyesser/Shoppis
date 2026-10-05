// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { loadCatalogPriceBounds } = vi.hoisted(() => ({ loadCatalogPriceBounds: vi.fn() }));

vi.mock('../composition/container', () => ({
  deps: () => ({ storefrontCatalogRepository: { loadCatalogPriceBounds } }),
}));

import { useStorefrontCatalogPriceBounds } from './useStorefrontCatalogPriceBounds';

let client: QueryClient;

beforeEach(() => {
  loadCatalogPriceBounds.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useStorefrontCatalogPriceBounds', () => {
  it('без publicId не ходит в сеть', () => {
    const { result } = renderHook(() => useStorefrontCatalogPriceBounds(null), { wrapper });
    expect(result.current.bounds).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(loadCatalogPriceBounds).not.toHaveBeenCalled();
  });

  it('enabled=false не ходит в сеть (PAUSED магазин)', () => {
    const { result } = renderHook(() => useStorefrontCatalogPriceBounds('pub1', false), {
      wrapper,
    });
    expect(result.current.bounds).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(loadCatalogPriceBounds).not.toHaveBeenCalled();
  });

  it('загружает границы', async () => {
    loadCatalogPriceBounds.mockResolvedValue({ minPrice: 8000, maxPrice: 320000 });

    const { result } = renderHook(() => useStorefrontCatalogPriceBounds('pub1'), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bounds).toEqual({ minPrice: 8000, maxPrice: 320000 });
  });

  it('null-границы сохраняются (пустой магазин)', async () => {
    loadCatalogPriceBounds.mockResolvedValue({ minPrice: null, maxPrice: null });
    const { result } = renderHook(() => useStorefrontCatalogPriceBounds('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bounds).toEqual({ minPrice: null, maxPrice: null });
  });
});

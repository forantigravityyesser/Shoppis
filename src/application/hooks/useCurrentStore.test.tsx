// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Store } from '../../domain/models/store';

const h = vi.hoisted(() => ({
  state: {
    currentStore: null as Store | null,
    authLoading: false,
    fetchCurrentStore: vi.fn(),
  },
}));

vi.mock('../store', () => ({
  useStore: Object.assign((selector: (s: typeof h.state) => unknown) => selector(h.state), {
    getState: () => h.state,
  }),
}));

import { useCurrentStore } from './useCurrentStore';

function store(): Store {
  return {
    id: 's1',
    ownerUserId: 'u1',
    ownerTelegramId: 'u1',
    name: 'Shop',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    supportHandle: '',
    currencyCode: 'USD',
    currencySymbol: '$',
    language: 'ru',
    status: 'ACTIVE',
    publicId: 'pub_s1',
    createdAt: '',
    tutorialWelcomeDecision: 'unknown',
    tutorialStatus: 'not_started',
    tutorialStep: null,
    tutorialUpdatedAt: null,
  };
}

beforeEach(() => {
  h.state.currentStore = null;
  h.state.authLoading = false;
  h.state.fetchCurrentStore = vi.fn().mockResolvedValue(undefined);
});

describe('useCurrentStore (R4)', () => {
  it('без магазина запускает загрузку', async () => {
    renderHook(() => useCurrentStore());
    await waitFor(() => expect(h.state.fetchCurrentStore).toHaveBeenCalledTimes(1));
  });

  it('с уже загруженным магазином в сеть не ходит', () => {
    h.state.currentStore = store();
    const { result } = renderHook(() => useCurrentStore());

    expect(h.state.fetchCurrentStore).not.toHaveBeenCalled();
    expect(result.current.store?.id).toBe('s1');
    expect(result.current.notFound).toBe(false);
  });

  it('запрос завершён без магазина → notFound, не error', async () => {
    const { result } = renderHook(() => useCurrentStore());

    await waitFor(() => expect(h.state.fetchCurrentStore).toHaveBeenCalled());
    expect(result.current.notFound).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('ошибка запроса → error, не notFound; retry повторяет запрос', async () => {
    h.state.fetchCurrentStore = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useCurrentStore());

    await waitFor(() => expect(result.current.error).toBe('network'));
    expect(result.current.notFound).toBe(false);

    result.current.retry();
    await waitFor(() => expect(h.state.fetchCurrentStore).toHaveBeenCalledTimes(2));
  });

  it('loading отражает authLoading при отсутствии магазина', () => {
    h.state.authLoading = true;
    const { result } = renderHook(() => useCurrentStore());
    expect(result.current.loading).toBe(true);
    expect(result.current.notFound).toBe(false);
  });
});

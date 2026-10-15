// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => {
  const store = {
    setSession: vi.fn(),
    clearSession: vi.fn(),
    setContext: vi.fn(),
    loadBuyerStore: vi.fn(async () => null),
    loadSellerStore: vi.fn(async () => null),
    setIsAppInitializing: vi.fn(),
  };
  const deps = {
    telegram: { getStartParam: vi.fn(() => '') },
    storeVisitApi: {
      recordStoreVisit: vi.fn(async () => {}),
      loadVisitedStores: vi.fn(async () => [] as unknown[]),
    },
  };
  const authenticate = vi.fn();
  return { store, deps, authenticate };
});

vi.mock('../store', () => ({
  useStore: { getState: () => h.store },
}));

vi.mock('../composition/container', () => ({
  deps: () => h.deps,
}));

vi.mock('../services/auth-service', () => ({
  authenticate: () => h.authenticate(),
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

import { useAppInit } from './useAppInit';

const SESSION = {
  token: 'session-token',
  user: {},
  serverVerified: true,
  bot: null as 'buyer' | 'seller' | null,
};

beforeEach(() => {
  localStorage.clear();
  h.store.setSession.mockReset();
  h.store.clearSession.mockReset();
  h.store.setContext.mockReset();
  h.store.loadBuyerStore.mockReset().mockResolvedValue(null);
  h.store.loadSellerStore.mockReset().mockResolvedValue(null);
  h.store.setIsAppInitializing.mockReset();
  h.deps.telegram.getStartParam.mockReset().mockReturnValue('');
  h.deps.storeVisitApi.recordStoreVisit.mockReset().mockResolvedValue(undefined);
  h.deps.storeVisitApi.loadVisitedStores.mockReset().mockResolvedValue([]);
  h.authenticate.mockReset();
});

describe('useAppInit — контекст входа (два бота)', () => {
  it('startapp=seller → панель продавца и загрузка его магазина', async () => {
    h.deps.telegram.getStartParam.mockReturnValue('seller');
    h.authenticate.mockResolvedValue({ ...SESSION, bot: 'seller' });

    renderHook(() => useAppInit());

    await waitFor(() => expect(h.store.setContext).toHaveBeenCalledWith('seller'));
    expect(h.store.loadSellerStore).toHaveBeenCalled();
    expect(h.store.loadBuyerStore).not.toHaveBeenCalled();
  });

  it('главный Mini App бота продавца (пустой startapp) → панель, а не пустая витрина', async () => {
    h.authenticate.mockResolvedValue({ ...SESSION, bot: 'seller' });

    renderHook(() => useAppInit());

    await waitFor(() => expect(h.store.setContext).toHaveBeenCalledWith('seller'));
    expect(h.store.loadSellerStore).toHaveBeenCalled();
    expect(h.store.loadBuyerStore).not.toHaveBeenCalled();
  });

  it('бот покупателя без deep-link → последняя витрина с сервера + визит', async () => {
    h.authenticate.mockResolvedValue({ ...SESSION, bot: 'buyer' });
    h.deps.storeVisitApi.loadVisitedStores.mockResolvedValue([
      { publicId: 'p1', name: 'Магазин', lastVisitedAt: '2026-10-14T00:00:00Z' },
    ]);

    renderHook(() => useAppInit());

    await waitFor(() => expect(h.store.loadBuyerStore).toHaveBeenCalledWith('p1'));
    expect(h.deps.storeVisitApi.recordStoreVisit).toHaveBeenCalledWith('session-token', 'p1');
    expect(localStorage.getItem('last_visited_store_public_id')).toBe('p1');
  });

  it('deep link shop_<public_id> → витрина, визит и запоминание последней витрины', async () => {
    h.deps.telegram.getStartParam.mockReturnValue('shop_abc');
    h.authenticate.mockResolvedValue({ ...SESSION, bot: 'buyer' });

    renderHook(() => useAppInit());

    await waitFor(() => expect(h.store.loadBuyerStore).toHaveBeenCalledWith('abc'));
    expect(localStorage.getItem('last_visited_store_public_id')).toBe('abc');
    expect(h.deps.storeVisitApi.recordStoreVisit).toHaveBeenCalledWith('session-token', 'abc');
    expect(h.deps.storeVisitApi.loadVisitedStores).not.toHaveBeenCalled();
  });

  it('localStorage уже хранит витрину → сервер не опрашивается', async () => {
    localStorage.setItem('last_visited_store_public_id', 'p9');
    h.authenticate.mockResolvedValue({ ...SESSION, bot: 'buyer' });

    renderHook(() => useAppInit());

    await waitFor(() => expect(h.store.loadBuyerStore).toHaveBeenCalledWith('p9'));
    expect(h.deps.storeVisitApi.loadVisitedStores).not.toHaveBeenCalled();
  });
});

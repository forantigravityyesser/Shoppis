// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const storeSettingsApi = { updateTutorialState: vi.fn() };

vi.mock('../composition/container', () => ({
  deps: () => ({ storeSettingsApi }),
}));

import { useStore } from '../store';
import { useSellerTutorial } from './useSellerTutorial';
import type { Store } from '../../domain/models/store';
import type { TutorialStatePatch } from '../contracts/store';

function store(overrides: Partial<Store> = {}): Store {
  return {
    id: 's1',
    ownerUserId: 'u1',
    ownerTelegramId: 'tg1',
    name: 'Shop',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    supportHandle: '',
    currencyCode: 'USD',
    currencySymbol: '$',
    language: 'ru',
    status: 'ACTIVE',
    publicId: 'pub1',
    createdAt: '2026-09-30T00:00:00.000Z',
    tutorialWelcomeDecision: 'unknown',
    tutorialStatus: 'not_started',
    tutorialStep: null,
    tutorialUpdatedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  storeSettingsApi.updateTutorialState.mockReset();
  // Сервер-заглушка: применяет патч и возвращает обновлённую проекцию магазина.
  storeSettingsApi.updateTutorialState.mockImplementation(
    async (_token: string | null, _storeId: string, patch: TutorialStatePatch) => ({
      ...store(),
      tutorialWelcomeDecision: patch.welcomeDecision,
      tutorialStatus: patch.status,
      tutorialStep: patch.step,
      tutorialUpdatedAt: '2026-10-15T00:00:00.000Z',
    }),
  );
  useStore.setState({
    storeId: 's1',
    sessionToken: 'tok',
    currentStore: store(),
  });
});

describe('useSellerTutorial (docs/26 TUT-02)', () => {
  it('по умолчанию предлагает обучение (unknown / not_started)', () => {
    const { result } = renderHook(() => useSellerTutorial());
    expect(result.current.shouldOffer).toBe(true);
    expect(result.current.interrupted).toBe(false);
    expect(result.current.step).toBeNull();
  });

  it('accept запускает обучение с первого шага и персистит состояние', async () => {
    const { result } = renderHook(() => useSellerTutorial());

    await act(async () => {
      await result.current.accept();
    });

    expect(storeSettingsApi.updateTutorialState).toHaveBeenCalledTimes(1);
    expect(storeSettingsApi.updateTutorialState).toHaveBeenCalledWith('tok', 's1', {
      welcomeDecision: 'accepted',
      status: 'in_progress',
      step: 'orientation',
    });
    expect(result.current.shouldOffer).toBe(false);
    expect(result.current.interrupted).toBe(true);
    expect(result.current.step).toBe('orientation');
    expect(result.current.progress).toEqual({ index: 1, total: 5 });
  });

  it('decline сохраняет отказ и больше не предлагает', async () => {
    const { result } = renderHook(() => useSellerTutorial());

    await act(async () => {
      await result.current.decline();
    });

    expect(storeSettingsApi.updateTutorialState).toHaveBeenCalledWith('tok', 's1', {
      welcomeDecision: 'declined',
      status: 'not_started',
      step: null,
    });
    expect(result.current.shouldOffer).toBe(false);
  });

  it('setStep продвигает шаг, complete завершает обучение', async () => {
    const { result } = renderHook(() => useSellerTutorial());
    await act(async () => {
      await result.current.accept();
    });
    await act(async () => {
      await result.current.setStep('product-create');
    });
    expect(result.current.step).toBe('product-create');

    await act(async () => {
      await result.current.complete();
    });
    expect(result.current.state.status).toBe('completed');
    expect(result.current.step).toBeNull();
    expect(result.current.interrupted).toBe(false);
  });

  it('повторный no-op переход не пишет на сервер (§3.8)', async () => {
    const { result } = renderHook(() => useSellerTutorial());
    await act(async () => {
      await result.current.accept();
    });
    expect(storeSettingsApi.updateTutorialState).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.accept(); // уже in_progress + orientation → no-op
    });
    expect(storeSettingsApi.updateTutorialState).toHaveBeenCalledTimes(1);
  });

  it('восстанавливает прерванное обучение: interrupt показывает активный шаг', async () => {
    useStore.setState({
      currentStore: store({
        tutorialWelcomeDecision: 'accepted',
        tutorialStatus: 'in_progress',
        tutorialStep: 'storefront',
      }),
    });

    const { result } = renderHook(() => useSellerTutorial());
    expect(result.current.interrupted).toBe(true);
    expect(result.current.step).toBe('storefront');
    expect(result.current.progress).toEqual({ index: 4, total: 5 });
  });

  it('notifyProductSaved продвигает product-create → product-buyer-view', async () => {
    useStore.setState({
      currentStore: store({
        tutorialWelcomeDecision: 'accepted',
        tutorialStatus: 'in_progress',
        tutorialStep: 'product-create',
      }),
    });

    const { result } = renderHook(() => useSellerTutorial());
    await act(async () => {
      await result.current.notifyProductSaved('p1');
    });

    expect(storeSettingsApi.updateTutorialState).toHaveBeenCalledWith('tok', 's1', {
      welcomeDecision: 'accepted',
      status: 'in_progress',
      step: 'product-buyer-view',
    });
  });

  it('notifyProductSaved — no-op вне шага product-create', async () => {
    useStore.setState({
      currentStore: store({
        tutorialWelcomeDecision: 'accepted',
        tutorialStatus: 'in_progress',
        tutorialStep: 'orientation',
      }),
    });

    const { result } = renderHook(() => useSellerTutorial());
    await act(async () => {
      await result.current.notifyProductSaved('p1');
    });

    expect(storeSettingsApi.updateTutorialState).not.toHaveBeenCalled();
  });
});

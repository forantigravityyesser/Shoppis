// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const storeSettingsApi = { updateTutorialState: vi.fn() };

vi.mock('../composition/container', () => ({
  deps: () => ({ storeSettingsApi }),
}));

import { useStore } from '../store';
import { useDashboardTutorial } from './useDashboardTutorial';
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
  useStore.setState({ storeId: 's1', sessionToken: 'tok', currentStore: store() });
});

describe('useDashboardTutorial (R5)', () => {
  it('welcome открыт при unknown/not_started, CTA нет', () => {
    const { result } = renderHook(() => useDashboardTutorial());
    expect(result.current.welcomeOpen).toBe(true);
    expect(result.current.cta).toBeNull();
  });

  it('start принимает обучение, закрывает welcome и даёт CTA «Продолжить»', async () => {
    const { result } = renderHook(() => useDashboardTutorial());

    await act(async () => {
      result.current.start();
    });

    expect(storeSettingsApi.updateTutorialState).toHaveBeenCalledWith('tok', 's1', {
      welcomeDecision: 'accepted',
      status: 'in_progress',
      step: 'orientation',
    });
    expect(result.current.welcomeOpen).toBe(false);
    expect(result.current.cta?.kind).toBe('resume');
  });

  it('decline сохраняет отказ и даёт CTA «Пройти»', async () => {
    const { result } = renderHook(() => useDashboardTutorial());

    await act(async () => {
      result.current.decline();
    });

    expect(storeSettingsApi.updateTutorialState).toHaveBeenCalledWith('tok', 's1', {
      welcomeDecision: 'declined',
      status: 'not_started',
      step: null,
    });
    expect(result.current.cta?.kind).toBe('start');
  });

  it('ошибка accept → welcome возвращается (не тупик)', async () => {
    storeSettingsApi.updateTutorialState.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useDashboardTutorial());

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => expect(result.current.welcomeOpen).toBe(true));
  });

  it('магазина нет → welcome закрыт', () => {
    useStore.setState({ currentStore: null });
    const { result } = renderHook(() => useDashboardTutorial());
    expect(result.current.welcomeOpen).toBe(false);
  });
});

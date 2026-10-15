// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Store } from '../../../domain/models/store';

const mockState = {
  currentStore: null as Store | null,
  authLoading: false,
  fetchCurrentStore: vi.fn(),
  updateStoreProfile: vi.fn(),
  uploadStoreBanner: vi.fn(),
};

vi.mock('../../../application/store', () => {
  const useStore = Object.assign(
    (selector: (s: typeof mockState) => unknown) => selector(mockState),
    { getState: () => mockState },
  );
  return { useStore };
});

vi.mock('../../shared/components/BackButton', () => ({
  default: () => <button type="button">back</button>,
}));

vi.mock('../settings/StoreIdentityBlock', () => ({
  default: () => <div data-testid="identity-block">identity</div>,
}));

import SettingsProfileView from './SettingsProfileView';

function makeStore(): Store {
  return {
    id: 's1',
    ownerUserId: 'u1',
    ownerTelegramId: 'tg1',
    name: 'My Shop',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    supportHandle: '',
    currencyCode: 'RUB',
    currencySymbol: '₽',
    language: 'ru',
    status: 'ACTIVE',
    publicId: 'pub1',
    createdAt: '2026-09-30T00:00:00.000Z',
    tutorialWelcomeDecision: 'unknown',
    tutorialStatus: 'not_started',
    tutorialStep: null,
    tutorialUpdatedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.currentStore = makeStore();
  mockState.authLoading = false;
  mockState.fetchCurrentStore = vi.fn();
  mockState.updateStoreProfile = vi.fn();
  mockState.uploadStoreBanner = vi.fn();
});

describe('SettingsProfileView (R4)', () => {
  it('магазин есть → рендерит блок профиля', () => {
    render(<SettingsProfileView />);
    expect(screen.getByTestId('identity-block')).toBeInTheDocument();
    expect(mockState.fetchCurrentStore).not.toHaveBeenCalled();
  });

  it('ошибка загрузки → alert с повтором, не «магазин не найден»', async () => {
    mockState.currentStore = null;
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    mockState.fetchCurrentStore = fetchMock;

    render(<SettingsProfileView />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить магазин'),
    );
    expect(screen.queryByText('Магазин не найден')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('магазина нет → сначала загрузка, потом пустое состояние, не ошибка', async () => {
    mockState.currentStore = null;
    mockState.fetchCurrentStore = vi.fn().mockResolvedValue(undefined);

    render(<SettingsProfileView />);

    // R2: до завершения запроса показываем загрузку, не «магазин не найден».
    expect(screen.getByText('Загрузка магазина…')).toBeInTheDocument();
    expect(await screen.findByText('Магазин не найден')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

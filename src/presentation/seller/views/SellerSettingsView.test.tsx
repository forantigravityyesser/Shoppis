// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SellerSettingsView from './SellerSettingsView';
import type { Store } from '../../../domain/models/store';

const mockNavigate = vi.fn();
const mockOpenTelegramLink = vi.fn();
const STOREFRONT_URL = 'https://t.me/BuyShoppis_bot/shop?startapp=shop_pub1';

const mockState = {
  currentStore: null as Store | null,
  authLoading: false,
  fetchCurrentStore: vi.fn(),
  updateStoreStatus: vi.fn(),
};

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../application/store', () => ({
  useStore: (selector: (s: typeof mockState) => unknown) => selector(mockState),
}));

vi.mock('../../../application/hooks/useStorefrontLink', () => ({
  useStorefrontLink: () => STOREFRONT_URL,
}));

vi.mock('../../../application/hooks/useOpenTelegramLink', () => ({
  useOpenTelegramLink: () => mockOpenTelegramLink,
}));

vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn() }),
}));

function makeStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 's1',
    ownerUserId: 'u1',
    ownerTelegramId: 'tg1',
    name: 'My Shop',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    supportHandle: 'manager',
    currencyCode: 'RUB',
    currencySymbol: '₽',
    language: 'ru',
    status: 'ACTIVE',
    publicId: 'pub1',
    createdAt: '2026-09-30T00:00:00.000Z',
    ...overrides,
  };
}

function saveButton() {
  return screen.queryByRole('button', { name: 'Сохранить' });
}

function hubSwitch() {
  return screen.getByRole('switch', { name: 'Магазин активен' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.currentStore = makeStore();
  mockState.authLoading = false;
  mockState.fetchCurrentStore = vi.fn();
  mockState.updateStoreStatus = vi.fn().mockResolvedValue(undefined);
});

describe('SellerSettingsView (Hub)', () => {
  it('показывает группы и строки без длинных форм', () => {
    render(<SellerSettingsView />);

    expect(screen.getByText('Магазин')).toBeInTheDocument();
    expect(screen.getByText('Для покупателей')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Профиль магазина/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Язык и валюта/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Контакты/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Поделиться магазином/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Предпросмотр/ })).toBeInTheDocument();

    // Форм на Hub нет: ни названия, ни валюты, ни контакта
    expect(screen.queryByLabelText('Название магазина')).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Валюта' })).toBeNull();
    expect(screen.queryByLabelText('Контакт для связи')).toBeNull();
  });

  it('показывает актуальные значения стора', () => {
    render(<SellerSettingsView />);

    expect(screen.getByText('My Shop')).toBeInTheDocument();
    expect(screen.getByText('Русский · RUB')).toBeInTheDocument();
    expect(screen.getByText('@manager')).toBeInTheDocument();
  });

  it('показывает «Не указан» без контакта и English для en', () => {
    mockState.currentStore = makeStore({ supportHandle: '', language: 'en', currencyCode: 'USD' });
    render(<SellerSettingsView />);

    expect(screen.getByText('Не указан')).toBeInTheDocument();
    expect(screen.getByText('English · USD')).toBeInTheDocument();
  });

  it('навигация открывает дочерние экраны', async () => {
    const user = userEvent.setup();
    render(<SellerSettingsView />);

    await user.click(screen.getByRole('button', { name: /Профиль магазина/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/seller/settings/profile');

    await user.click(screen.getByRole('button', { name: /Язык и валюта/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/seller/settings/localization');

    await user.click(screen.getByRole('button', { name: /Контакты/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/seller/settings/contact');

    await user.click(screen.getByRole('button', { name: /Поделиться магазином/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/seller/settings/share');
  });

  it('предпросмотр — действие без шеврона, навигация — с шевроном', async () => {
    const user = userEvent.setup();
    render(<SellerSettingsView />);

    const preview = screen.getByRole('button', { name: 'Предпросмотр' });
    expect(preview).toHaveClass('settings-row--action');
    expect(preview.querySelector('.settings-row__chevron')).toBeNull();

    const profile = screen.getByRole('button', { name: /Профиль магазина/ });
    expect(profile.querySelector('.settings-row__chevron')).not.toBeNull();

    await user.click(preview);
    expect(mockOpenTelegramLink).toHaveBeenCalledWith(STOREFRONT_URL);
  });

  it('в clean state Save скрыт, toggle отражает статус', () => {
    render(<SellerSettingsView />);

    expect(hubSwitch()).toBeChecked();
    expect(saveButton()).toBeNull();
  });

  it('выключение показывает Save, но сохраняет только через подтверждение', async () => {
    const user = userEvent.setup();
    render(<SellerSettingsView />);

    await user.click(hubSwitch());
    expect(saveButton()).toBeInTheDocument();
    expect(mockState.updateStoreStatus).not.toHaveBeenCalled();

    await user.click(saveButton() as HTMLElement);
    expect(screen.getByText(/Магазин временно закроется/)).toBeInTheDocument();
    expect(mockState.updateStoreStatus).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Приостановить' }));
    expect(mockState.updateStoreStatus).toHaveBeenCalledWith('PAUSED');
  });

  it('включение приостановленного магазина сохраняет ACTIVE без подтверждения', async () => {
    const user = userEvent.setup();
    mockState.currentStore = makeStore({ status: 'PAUSED' });
    render(<SellerSettingsView />);

    expect(hubSwitch()).not.toBeChecked();
    await user.click(hubSwitch());
    await user.click(saveButton() as HTMLElement);

    expect(mockState.updateStoreStatus).toHaveBeenCalledWith('ACTIVE');
  });

  it('при ошибке показывает сообщение и сохраняет draft', async () => {
    const user = userEvent.setup();
    mockState.updateStoreStatus = vi.fn().mockRejectedValue(new Error('FORBIDDEN'));
    render(<SellerSettingsView />);

    await user.click(hubSwitch());
    await user.click(saveButton() as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Приостановить' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('FORBIDDEN'));
    expect(hubSwitch()).not.toBeChecked();
    // Подтверждение остаётся открытым — можно повторить без потери draft
    expect(screen.getByRole('button', { name: 'Приостановить' })).toBeInTheDocument();
  });

  it('после возврата с обновлённым стором показывает новое значение', async () => {
    const { rerender } = render(<SellerSettingsView />);
    expect(screen.getByText('Русский · RUB')).toBeInTheDocument();

    mockState.currentStore = makeStore({ currencyCode: 'USD', language: 'en' });
    rerender(<SellerSettingsView />);

    await waitFor(() => expect(screen.getByText('English · USD')).toBeInTheDocument());
    expect(saveButton()).toBeNull();
  });

  it('показывает загрузку и пустое состояние', () => {
    mockState.currentStore = null;
    mockState.authLoading = true;
    const { unmount } = render(<SellerSettingsView />);
    expect(screen.getByText('Загрузка магазина…')).toBeInTheDocument();
    unmount();

    mockState.authLoading = false;
    render(<SellerSettingsView />);
    expect(screen.getByText('Магазин не найден')).toBeInTheDocument();
  });
});

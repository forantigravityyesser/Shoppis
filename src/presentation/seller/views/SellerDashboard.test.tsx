// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SellerDashboardSummary } from '../../../application/read-models/seller-dashboard';

interface MockStore {
  name: string;
  currencySymbol: string;
  currencyCode: 'USD';
  logoUrl: string;
  status: 'ACTIVE' | 'PAUSED';
  bannerUrl: string;
  description: string;
  supportHandle: string;
  tutorialWelcomeDecision: 'unknown' | 'accepted' | 'declined';
  tutorialStatus: 'not_started' | 'in_progress' | 'completed' | 'dismissed';
  tutorialStep: string | null;
  tutorialUpdatedAt: string | null;
}

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  refetch: vi.fn(),
  state: {
    currentStore: null as MockStore | null,
    updateTutorialState: vi.fn(),
  },
  dash: {
    summary: null as unknown,
    loading: false,
    error: null as string | null,
    disabledReason: null as string | null,
    refetch: vi.fn(),
  },
}));

vi.mock('react-router', () => ({ useNavigate: () => h.navigate }));
vi.mock('../../../application/store', () => {
  const useStore = Object.assign((selector: (s: typeof h.state) => unknown) => selector(h.state), {
    getState: () => h.state,
  });
  return { useStore };
});
vi.mock('../../../application/hooks/useSellerDashboard', () => ({
  useSellerDashboard: () => h.dash,
}));

import SellerDashboard from './SellerDashboard';

const summary: SellerDashboardSummary = {
  orders: { new: 1, inTransit: 2, delivered: 3, history: 4 },
  sales: { receivedMinor: 0, frozenMinor: 0 },
  inventory: {
    activeProducts: 0,
    archivedProducts: 0,
    activeCategories: 0,
    buyerAvailableProducts: 0,
  },
  growth: { firstOrderAt: null, firstShippedAt: null, firstCompletedAt: null },
};

function mockStore(overrides: Partial<MockStore> = {}): MockStore {
  return {
    name: 'Мой магазин',
    currencySymbol: '$',
    currencyCode: 'USD',
    logoUrl: '',
    status: 'ACTIVE',
    bannerUrl: '',
    description: '',
    supportHandle: '',
    tutorialWelcomeDecision: 'unknown',
    tutorialStatus: 'not_started',
    tutorialStep: null,
    tutorialUpdatedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  h.navigate.mockReset();
  h.refetch.mockReset();
  h.state.updateTutorialState.mockReset();
  h.state.currentStore = mockStore();
  h.dash = {
    summary: null,
    loading: false,
    error: null,
    disabledReason: null,
    refetch: h.refetch,
  };
});

describe('SellerDashboard (docs/25 SDB-06)', () => {
  it('название магазина — крупный заголовок с чипом статуса', () => {
    render(<SellerDashboard />);
    expect(screen.getByRole('heading', { level: 1, name: 'Мой магазин' })).toBeInTheDocument();
    expect(screen.getByText('Магазин активен')).toBeInTheDocument();
  });

  it('приостановленный магазин — чип «на паузе»', () => {
    h.state.currentStore = mockStore({ status: 'PAUSED' });
    render(<SellerDashboard />);
    expect(screen.getByText('Магазин на паузе')).toBeInTheDocument();
  });

  it('loading → skeleton', () => {
    h.dash.loading = true;
    render(<SellerDashboard />);
    expect(screen.getByRole('status', { name: 'Загрузка сводки' })).toBeInTheDocument();
  });

  it('error → состояние ошибки с повтором', async () => {
    h.dash.error = 'boom';
    render(<SellerDashboard />);
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(h.refetch).toHaveBeenCalledTimes(1);
  });

  it('no-store → пустое состояние (нет магазина)', () => {
    h.dash.disabledReason = 'no-store';
    render(<SellerDashboard />);
    expect(screen.getByTestId('dashboard-empty')).toHaveTextContent('Нет данных магазина');
  });

  it('no-session → состояние сессии с кнопкой обновления', () => {
    h.dash.disabledReason = 'no-session';
    render(<SellerDashboard />);
    const empty = screen.getByTestId('dashboard-empty');
    expect(empty).toHaveTextContent('Сессия недоступна');
    expect(within(empty).getByRole('button', { name: 'Обновить' })).toBeInTheDocument();
  });

  it('disabled → «Сводка отключена»', () => {
    h.dash.disabledReason = 'disabled';
    render(<SellerDashboard />);
    expect(screen.getByTestId('dashboard-empty')).toHaveTextContent('Сводка отключена');
  });

  it('success без сводки → «Сводка недоступна»', () => {
    h.dash.summary = null;
    render(<SellerDashboard />);
    expect(screen.getByTestId('dashboard-empty')).toHaveTextContent('Сводка недоступна');
  });

  it('success → блок «Заказы» с 4 индикаторами', () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);
    const orders = screen.getByTestId('dashboard-orders-stats');
    expect(orders).toBeInTheDocument();
    expect(within(orders).getAllByTestId('dashboard-stat')).toHaveLength(4);
  });

  it('клик по индикатору ведёт в заказы с фильтром статуса', async () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);
    await userEvent.click(screen.getByRole('button', { name: 'История: 4' }));
    expect(h.navigate).toHaveBeenCalledWith('/seller/orders?status=history');
  });

  it('клик по заголовку блока ведёт во все заказы', async () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);
    await userEvent.click(screen.getByRole('button', { name: 'Заказы' }));
    expect(h.navigate).toHaveBeenCalledWith('/seller/orders');
  });

  it('клик по «Категории» ведёт в раздел категорий инвентаря', async () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);
    await userEvent.click(screen.getByRole('button', { name: /Категории/ }));
    expect(h.navigate).toHaveBeenCalledWith('/seller/inventory?mode=categories');
  });

  it('success → блок «Продажи»; клик ведёт на экран продаж', async () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);
    expect(screen.getByTestId('dashboard-sales')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Заработано/ }));
    expect(h.navigate).toHaveBeenCalledWith('/seller/sales');
  });

  it('growth: ближайшая цель (первый заказ) + CTA ведёт на шаринг', async () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);

    const block = screen.getByTestId('dashboard-growth');
    expect(block).toHaveTextContent('Получите первый заказ');
    await userEvent.click(screen.getByRole('button', { name: 'Поделиться витриной' }));
    expect(h.navigate).toHaveBeenCalledWith('/seller/settings/share');
  });

  it('growth: после первого заказа показывается следующая цель, не будущая', () => {
    h.dash.summary = {
      ...summary,
      growth: {
        firstOrderAt: '2026-01-01T00:00:00.000Z',
        firstShippedAt: null,
        firstCompletedAt: null,
      },
    };
    render(<SellerDashboard />);

    const block = screen.getByTestId('dashboard-growth');
    expect(block).toHaveTextContent('Отправьте первый заказ');
    expect(block).not.toHaveTextContent('Получите первый заказ');
    expect(block).not.toHaveTextContent('Завершите первый заказ');
  });

  it('неполная готовность → чек-лист виден над блоком развития', () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);
    expect(screen.getByTestId('dashboard-checklist')).toBeInTheDocument();
  });

  it('готовность 5/5 → чек-лист скрыт, «Развитие магазина» остаётся', () => {
    h.state.currentStore = mockStore({
      bannerUrl: 'https://cdn.example/banner.jpg',
      supportHandle: 'Dnk_65',
    });
    h.dash.summary = {
      ...summary,
      inventory: {
        activeProducts: 1,
        archivedProducts: 0,
        activeCategories: 1,
        buyerAvailableProducts: 1,
      },
    };
    render(<SellerDashboard />);

    expect(screen.queryByTestId('dashboard-checklist')).toBeNull();
    expect(screen.getByTestId('dashboard-growth')).toBeInTheDocument();
  });

  it('welcome-шит до первого решения; «Начать знакомство» стартует обучение', async () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Начать знакомство' }));

    expect(h.state.updateTutorialState).toHaveBeenCalledWith({
      welcomeDecision: 'accepted',
      status: 'in_progress',
      step: 'orientation',
    });
  });

  it('«Позже» сохраняет отказ (declined)', async () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);

    await userEvent.click(screen.getByRole('button', { name: 'Позже' }));

    expect(h.state.updateTutorialState).toHaveBeenCalledWith({
      welcomeDecision: 'declined',
      status: 'not_started',
      step: null,
    });
  });

  it('после отказа CTA «Пройти обучение» в чек-листе запускает обучение', async () => {
    h.state.currentStore = mockStore({ tutorialWelcomeDecision: 'declined' });
    h.dash.summary = summary;
    render(<SellerDashboard />);

    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Пройти обучение' }));

    expect(h.state.updateTutorialState).toHaveBeenCalledWith({
      welcomeDecision: 'accepted',
      status: 'in_progress',
      step: 'orientation',
    });
  });

  it('во время обучения — CTA «Продолжить обучение», без welcome-шита', () => {
    h.state.currentStore = mockStore({
      tutorialWelcomeDecision: 'accepted',
      tutorialStatus: 'in_progress',
      tutorialStep: 'product-create',
    });
    h.dash.summary = summary;
    render(<SellerDashboard />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Продолжить обучение' })).toBeInTheDocument();
  });

  it('после завершения обучения welcome не показывается и CTA отсутствует', () => {
    h.state.currentStore = mockStore({
      tutorialWelcomeDecision: 'accepted',
      tutorialStatus: 'completed',
    });
    h.dash.summary = summary;
    render(<SellerDashboard />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /обучение/ })).toBeNull();
  });
});

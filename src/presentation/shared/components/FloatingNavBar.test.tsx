// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useLocation, useNavigate, selectTick } = vi.hoisted(() => ({
  useLocation: vi.fn(),
  useNavigate: vi.fn(),
  selectTick: vi.fn(),
}));

vi.mock('react-router', () => ({ useLocation, useNavigate }));
vi.mock('../../../application/hooks/useHaptic', () => ({ useHaptic: () => ({ selectTick }) }));

import FloatingNavBar from './FloatingNavBar';

let navigate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  navigate = vi.fn();
  useNavigate.mockReturnValue(navigate);
  useLocation.mockReturnValue({ pathname: '/' });
  selectTick.mockReset();
});

describe('FloatingNavBar', () => {
  it('рендерит 5 вкладок в нужном порядке', () => {
    render(<FloatingNavBar />);
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('aria-label') ?? t.textContent)).toEqual([
      'Главная',
      'Каталог',
      'Избранное',
      'Заказы',
      'Корзина',
    ]);
  });

  it('подсвечивает активную вкладку по pathname', () => {
    useLocation.mockReturnValue({ pathname: '/catalog' });
    render(<FloatingNavBar />);
    expect(screen.getByRole('tab', { name: 'Каталог' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Главная' })).toHaveAttribute('aria-selected', 'false');
  });

  it('переход по неактивной вкладке + haptic', async () => {
    render(<FloatingNavBar />);
    await userEvent.click(screen.getByRole('tab', { name: 'Заказы' }));
    expect(navigate).toHaveBeenCalledWith('/orders');
    expect(selectTick).toHaveBeenCalledTimes(1);
  });

  it('повторный тап по активной вкладке не навигирует', async () => {
    render(<FloatingNavBar />);
    await userEvent.click(screen.getByRole('tab', { name: 'Главная' }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('вкладка «Избранное» — обычная, ведёт в /favorites', async () => {
    render(<FloatingNavBar />);
    const heart = screen.getByRole('tab', { name: 'Избранное' });
    expect(heart).not.toHaveClass('bottom-nav__tab--center');
    expect(heart.querySelector('svg')?.getAttribute('width')).toBe('22');

    await userEvent.click(heart);
    expect(navigate).toHaveBeenCalledWith('/favorites');
  });

  it('на неизвестном маршруте нет активной вкладки', () => {
    useLocation.mockReturnValue({ pathname: '/product/p1' });
    render(<FloatingNavBar />);
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-selected', 'false');
    }
  });
});

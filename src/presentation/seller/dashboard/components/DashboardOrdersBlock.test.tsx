// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardOrdersBlock from './DashboardOrdersBlock';

const counts = { new: 2, inTransit: 1, delivered: 3, history: 4 };

describe('DashboardOrdersBlock (docs/25 §4.1)', () => {
  it('рендерит 4 индикатора с подписями и значениями', () => {
    render(<DashboardOrdersBlock counts={counts} onOpenAll={() => {}} onOpenStatus={() => {}} />);
    const grid = screen.getByTestId('dashboard-orders-stats');
    expect(grid).toHaveTextContent('Новые');
    expect(grid).toHaveTextContent('В пути');
    expect(grid).toHaveTextContent('Доставлено');
    expect(grid).toHaveTextContent('История');
    expect(screen.getAllByTestId('dashboard-stat')).toHaveLength(4);
  });

  it('статусы — карточки-кнопки (класс dash-stats--cards)', () => {
    render(<DashboardOrdersBlock counts={counts} onOpenAll={() => {}} onOpenStatus={() => {}} />);
    expect(screen.getByTestId('dashboard-orders-stats').className).toContain('dash-stats--cards');
    screen.getAllByTestId('dashboard-stat').forEach((stat) => {
      expect(stat.tagName).toBe('BUTTON');
      expect(stat.className).toContain('dash-stat--clickable');
    });
  });

  it('тона индикаторов: new/transit/delivered/history', () => {
    render(<DashboardOrdersBlock counts={counts} onOpenAll={() => {}} onOpenStatus={() => {}} />);
    const tones = screen.getAllByTestId('dashboard-stat').map((s) => s.getAttribute('data-tone'));
    expect(tones).toEqual(['new', 'transit', 'delivered', 'history']);
  });

  it('значение 0 отображается (не скрывается)', () => {
    render(
      <DashboardOrdersBlock
        counts={{ new: 0, inTransit: 0, delivered: 0, history: 0 }}
        onOpenAll={() => {}}
        onOpenStatus={() => {}}
      />,
    );
    const stats = screen.getAllByTestId('dashboard-stat');
    expect(stats.every((s) => s.textContent?.includes('0'))).toBe(true);
  });

  it('клик по индикатору → onOpenStatus с фильтром статуса', async () => {
    const onOpenStatus = vi.fn();
    render(
      <DashboardOrdersBlock counts={counts} onOpenAll={() => {}} onOpenStatus={onOpenStatus} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Новые: 2' }));
    expect(onOpenStatus).toHaveBeenLastCalledWith('NEW');
    await userEvent.click(screen.getByRole('button', { name: 'В пути: 1' }));
    expect(onOpenStatus).toHaveBeenLastCalledWith('IN_TRANSIT');
    await userEvent.click(screen.getByRole('button', { name: 'Доставлено: 3' }));
    expect(onOpenStatus).toHaveBeenLastCalledWith('DELIVERED');
    await userEvent.click(screen.getByRole('button', { name: 'История: 4' }));
    expect(onOpenStatus).toHaveBeenLastCalledWith('history');
    expect(onOpenStatus).toHaveBeenCalledTimes(4);
  });

  it('клик по заголовку блока → onOpenAll (все заказы)', async () => {
    const onOpenAll = vi.fn();
    render(<DashboardOrdersBlock counts={counts} onOpenAll={onOpenAll} onOpenStatus={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Заказы' }));
    expect(onOpenAll).toHaveBeenCalledTimes(1);
  });
});

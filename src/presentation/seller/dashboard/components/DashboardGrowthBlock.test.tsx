// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardGrowthBlock from './DashboardGrowthBlock';
import type { SellerDashboardGrowth } from '../../../../application/read-models/seller-dashboard';

const EMPTY: SellerDashboardGrowth = {
  firstOrderAt: null,
  firstShippedAt: null,
  firstCompletedAt: null,
};

describe('DashboardGrowthBlock (docs/26 TUT-08)', () => {
  it('нет заказов → цель 1 «Получите первый заказ» + CTA шаринга', async () => {
    const onShare = vi.fn();
    render(<DashboardGrowthBlock growth={EMPTY} onShare={onShare} />);

    expect(screen.getByTestId('dashboard-growth')).toHaveTextContent('Получите первый заказ');
    await userEvent.click(screen.getByRole('button', { name: 'Поделиться витриной' }));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('первый заказ получен → показывается цель отправки, без CTA', () => {
    render(
      <DashboardGrowthBlock
        growth={{ ...EMPTY, firstOrderAt: '2026-01-01T00:00:00.000Z' }}
        onShare={() => {}}
      />,
    );

    expect(screen.getByTestId('dashboard-growth')).toHaveTextContent('Отправьте первый заказ');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('заказ отправлен → цель завершения', () => {
    render(
      <DashboardGrowthBlock
        growth={{ ...EMPTY, firstOrderAt: 't1', firstShippedAt: 't2' }}
        onShare={() => {}}
      />,
    );
    expect(screen.getByTestId('dashboard-growth')).toHaveTextContent('Завершите первый заказ');
  });

  it('все цели достигнуты → положительное состояние', () => {
    render(
      <DashboardGrowthBlock
        growth={{ firstOrderAt: 't1', firstShippedAt: 't2', firstCompletedAt: 't3' }}
        onShare={() => {}}
      />,
    );
    expect(screen.getByTestId('dashboard-growth')).toHaveTextContent('Все цели достигнуты!');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

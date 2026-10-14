// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardSalesBlock from './DashboardSalesBlock';

const sales = { receivedMinor: 100000, frozenMinor: 50000 };

describe('DashboardSalesBlock (docs/25 §4.3)', () => {
  it('две карточки с суммами и тонами earned/frozen', () => {
    render(<DashboardSalesBlock sales={sales} currencySymbol="$" onOpen={() => {}} />);
    const earned = screen.getByRole('button', { name: /Заработано/ });
    const frozen = screen.getByRole('button', { name: /Потенциально/ });
    expect(within(earned).getByTestId('dashboard-money')).toHaveAttribute('data-tone', 'earned');
    expect(within(earned).getByTestId('dashboard-money')).toHaveTextContent('1000 $');
    expect(within(frozen).getByTestId('dashboard-money')).toHaveAttribute('data-tone', 'frozen');
    expect(within(frozen).getByTestId('dashboard-money')).toHaveTextContent('500 $');
  });

  it('клик по «Заработано» → onOpen', async () => {
    const onOpen = vi.fn();
    render(<DashboardSalesBlock sales={sales} currencySymbol="$" onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: /Заработано/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('клик по «Потенциально» → onOpen', async () => {
    const onOpen = vi.fn();
    render(<DashboardSalesBlock sales={sales} currencySymbol="$" onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: /Потенциально/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('нулевые суммы отображаются', () => {
    render(
      <DashboardSalesBlock
        sales={{ receivedMinor: 0, frozenMinor: 0 }}
        currencySymbol="$"
        onOpen={() => {}}
      />,
    );
    expect(screen.getAllByTestId('dashboard-money')).toHaveLength(2);
    screen.getAllByTestId('dashboard-money').forEach((m) => expect(m).toHaveTextContent('0 $'));
  });
});

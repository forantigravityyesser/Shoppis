// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardMoney from './DashboardMoney';

describe('DashboardMoney (docs/25 §4.3)', () => {
  it('форматирует сумму с символом валюты', () => {
    render(<DashboardMoney minor={100000} symbol="$" tone="earned" />);
    expect(screen.getByTestId('dashboard-money')).toHaveTextContent('1000 $');
  });

  it('применяет цветовой тон', () => {
    render(<DashboardMoney minor={5000} symbol="₽" tone="frozen" />);
    const money = screen.getByTestId('dashboard-money');
    expect(money).toHaveAttribute('data-tone', 'frozen');
    expect(money.className).toContain('dash-money--frozen');
  });

  it('нулевая сумма отображается', () => {
    render(<DashboardMoney minor={0} symbol="$" tone="earned" />);
    expect(screen.getByTestId('dashboard-money')).toHaveTextContent('0 $');
  });
});

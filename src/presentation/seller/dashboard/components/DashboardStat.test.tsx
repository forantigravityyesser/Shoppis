// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardStat from './DashboardStat';

describe('DashboardStat', () => {
  it('рендерит значение и подпись', () => {
    render(<DashboardStat label="Новые" value={3} />);
    const stat = screen.getByTestId('dashboard-stat');
    expect(stat).toHaveTextContent('3');
    expect(stat).toHaveTextContent('Новые');
  });

  it('по умолчанию нейтральный тон', () => {
    render(<DashboardStat label="Всего" value={0} />);
    expect(screen.getByTestId('dashboard-stat')).toHaveAttribute('data-tone', 'neutral');
  });

  it('применяет цветовой тон', () => {
    render(<DashboardStat label="Получено" value="1 000 ₽" tone="earned" />);
    const stat = screen.getByTestId('dashboard-stat');
    expect(stat).toHaveAttribute('data-tone', 'earned');
    expect(stat.className).toContain('dash-stat--earned');
  });

  it('0 — валидное значение (отображается)', () => {
    render(<DashboardStat label="История" value={0} tone="history" />);
    expect(screen.getByTestId('dashboard-stat')).toHaveTextContent('0');
  });

  it('onClick рендерит кнопку и вызывает обработчик', async () => {
    const onClick = vi.fn();
    render(
      <DashboardStat label="Новые" value={3} tone="new" onClick={onClick} ariaLabel="Новые: 3" />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Новые: 3' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

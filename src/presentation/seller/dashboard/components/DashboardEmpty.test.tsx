// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardEmpty from './DashboardEmpty';

describe('DashboardEmpty', () => {
  it('показывает заголовок', () => {
    render(<DashboardEmpty title="Нет данных магазина" />);
    expect(screen.getByTestId('dashboard-empty')).toHaveTextContent('Нет данных магазина');
  });

  it('рендерит необязательный текст', () => {
    render(<DashboardEmpty title="Пусто" text="Откройте магазин" />);
    expect(screen.getByTestId('dashboard-empty')).toHaveTextContent('Откройте магазин');
  });

  it('действие восстановления рендерит кнопку и вызывает onClick', async () => {
    const onClick = vi.fn();
    render(<DashboardEmpty title="Сессия" action={{ label: 'Обновить', onClick }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardError from './DashboardError';

describe('DashboardError', () => {
  it('по умолчанию показывает заголовок и текст ошибки', () => {
    render(<DashboardError onRetry={() => {}} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Не удалось загрузить сводку');
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('вызывает onRetry по кнопке', async () => {
    const onRetry = vi.fn();
    render(<DashboardError onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('принимает кастомные title/text', () => {
    render(<DashboardError onRetry={() => {}} title="Ошибка" text="Текст" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Ошибка');
    expect(screen.getByRole('alert')).toHaveTextContent('Текст');
  });
});

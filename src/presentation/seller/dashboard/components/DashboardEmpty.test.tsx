// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});

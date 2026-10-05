// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import CatalogFilterSheet from './CatalogFilterSheet';

function renderSheet(overrides: Partial<ComponentProps<typeof CatalogFilterSheet>> = {}) {
  const props = {
    open: true,
    bounds: { minPrice: 8000, maxPrice: 320000 },
    currencySymbol: '€',
    appliedMin: null as number | null,
    appliedMax: null as number | null,
    onClose: vi.fn(),
    onApply: vi.fn(),
    ...overrides,
  };
  render(<CatalogFilterSheet {...props} />);
  return props;
}

const valueOf = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;

describe('CatalogFilterSheet', () => {
  it('рендерит слайдер цены с границами магазина', () => {
    renderSheet();
    expect(screen.getByText('Цена')).toBeInTheDocument();
    expect(valueOf('Цена от')).toBe('8000');
    expect(valueOf('Цена до')).toBe('320000');
  });

  it('полный диапазон → onApply(null, null) и закрытие', () => {
    const props = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Показать товары' }));
    expect(props.onApply).toHaveBeenCalledWith(null, null);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('сужение диапазона → onApply с новыми границами', () => {
    const props = renderSheet();
    fireEvent.change(screen.getByLabelText('Цена от'), { target: { value: '50000' } });
    fireEvent.change(screen.getByLabelText('Цена до'), { target: { value: '200000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Показать товары' }));
    expect(props.onApply).toHaveBeenCalledWith(50000, 200000);
  });

  it('применённые значения подхватываются как драфт', () => {
    renderSheet({ appliedMin: 50000, appliedMax: 200000 });
    expect(valueOf('Цена от')).toBe('50000');
    expect(valueOf('Цена до')).toBe('200000');
  });

  it('«Сбросить» возвращает полный диапазон', () => {
    renderSheet({ appliedMin: 50000, appliedMax: 200000 });
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить' }));
    expect(valueOf('Цена от')).toBe('8000');
    expect(valueOf('Цена до')).toBe('320000');
  });

  it('нет границ → сообщение; применение просто закрывает', () => {
    const props = renderSheet({ bounds: null });
    expect(screen.getByText('Пока нет доступных цен для фильтра.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Показать товары' }));
    expect(props.onApply).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });
});

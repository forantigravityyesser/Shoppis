// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CategoryCard from './CategoryCard';
import type { InventoryCategoryItem } from '../../../../application/hooks/useInventory';

const CATEGORY: InventoryCategoryItem = {
  id: 'c1',
  name: 'Обувь',
  imageUrl: null,
  emoji: '',
  productCount: 3,
  archivedCount: 0,
  lowStockThreshold: 0,
  sortOrder: 0,
};

function renderCard(overrides: Partial<ComponentProps<typeof CategoryCard>> = {}) {
  const props = {
    category: CATEGORY,
    previewProducts: [],
    onOpen: vi.fn(),
    onOpenProduct: vi.fn(),
    onAddProduct: vi.fn(),
    ...overrides,
  };
  render(<CategoryCard {...props} />);
  return props;
}

describe('CategoryCard rank badge', () => {
  it('показывает номер позиции и по клику вызывает onReorder, не открывая категорию', async () => {
    const props = renderCard({ position: 2, onReorder: vi.fn() });

    const badge = screen.getByRole('button', { name: /Позиция 2 в каталоге/ });
    expect(badge).toHaveTextContent('2');
    expect(badge.className).toContain('inv-cat__rank--2');

    await userEvent.click(badge);
    expect(props.onReorder).toHaveBeenCalledTimes(1);
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it('позиции 5+ получают нейтральный цвет', () => {
    renderCard({ position: 7, onReorder: vi.fn() });
    expect(screen.getByRole('button', { name: /Позиция 7/ }).className).toContain(
      'inv-cat__rank--n',
    );
  });

  it('без позиции бейдж не рендерится (системная категория)', () => {
    renderCard({ onReorder: vi.fn() });
    expect(screen.queryByRole('button', { name: /Позиция/ })).toBeNull();
  });

  it('без onReorder бейдж не рендерится', () => {
    renderCard({ position: 1 });
    expect(screen.queryByRole('button', { name: /Позиция/ })).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InventoryCategoryRow from './InventoryCategoryRow';
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

function renderCard(overrides: Partial<ComponentProps<typeof InventoryCategoryRow>> = {}) {
  const props = {
    category: CATEGORY,
    previewProducts: [],
    onOpen: vi.fn(),
    onOpenProduct: vi.fn(),
    onAddProduct: vi.fn(),
    ...overrides,
  };
  const utils = render(<InventoryCategoryRow {...props} />);
  return { ...props, ...utils };
}

describe('InventoryCategoryRow rank badge', () => {
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

describe('InventoryCategoryRow — метаданные и длинное имя (docs/20 §7, §10)', () => {
  it('показывает «+N в архиве» при наличии архивных товаров', () => {
    const { container } = renderCard({
      category: { ...CATEGORY, productCount: 5, archivedCount: 3 },
    });
    const archived = container.querySelector('.inv-cat__archived');
    expect(archived).not.toBeNull();
    expect(archived?.textContent).toContain('+3');
    expect(archived?.textContent).toContain('в архиве');
  });

  it('не показывает архивный счётчик при archivedCount = 0', () => {
    const { container } = renderCard();
    expect(container.querySelector('.inv-cat__archived')).toBeNull();
  });

  it('длинное имя и позиция рендерятся вместе, без pair/compact-разметки', () => {
    const longName = 'Очень длинное название категории, которое должно обрезаться в строке';
    const { container } = renderCard({
      category: { ...CATEGORY, name: longName },
      position: 4,
      onReorder: vi.fn(),
    });
    expect(container.querySelector('.inv-cat__name')?.textContent).toBe(longName);
    expect(screen.getByRole('button', { name: /Позиция 4/ })).toBeInTheDocument();
    expect(container.querySelector('.inv-cat-row--pair')).toBeNull();
    expect(container.querySelector('.inv-cat--compact')).toBeNull();
  });

  it('пустое превью показывает «Пока нет товаров» и «+ Добавить товар»', () => {
    renderCard();
    expect(screen.getByText('Пока нет товаров')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Добавить товар' })).toBeInTheDocument();
  });
});

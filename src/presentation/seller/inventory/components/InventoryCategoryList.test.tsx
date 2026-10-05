// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InventoryCategoryList from './InventoryCategoryList';
import type { InventoryCategoryItem } from '../../../../application/hooks/useInventory';

function makeCategory(id: string, name: string): InventoryCategoryItem {
  return {
    id,
    name,
    imageUrl: null,
    emoji: '📦',
    productCount: 2,
    archivedCount: 0,
    lowStockThreshold: 0,
    sortOrder: Number(id.slice(1)) || 0,
  };
}

function renderList(overrides: Partial<Parameters<typeof InventoryCategoryList>[0]> = {}) {
  const props = {
    categories: [makeCategory('c1', 'Обувь'), makeCategory('c2', 'Одежда')],
    productsByCategory: {},
    onOpenCategory: vi.fn(),
    onOpenProduct: vi.fn(),
    onAddProduct: vi.fn(),
    ...overrides,
  };
  const utils = render(<InventoryCategoryList {...props} />);
  return { ...props, ...utils };
}

describe('InventoryCategoryList — полноширинные строки (docs/20 §7)', () => {
  it('каждая категория — одна строка во всю ширину, без pair/compact', () => {
    const { container, categories } = renderList();
    expect(container.querySelectorAll('.inv-cat').length).toBe(categories.length);
    expect(container.querySelectorAll('.inv-cat-row').length).toBe(categories.length);
    expect(container.querySelector('.inv-cat-row--pair')).toBeNull();
    expect(container.querySelector('.inv-cat--compact')).toBeNull();
  });

  it('сохраняет навигацию по категории', async () => {
    const onOpenCategory = vi.fn();
    renderList({ categories: [makeCategory('c1', 'Обувь')], onOpenCategory });
    await userEvent.click(screen.getByText('Обувь'));
    expect(onOpenCategory).toHaveBeenCalledWith('c1');
  });

  it('сохраняет реордер через бейдж позиции', async () => {
    const onReorderCategory = vi.fn();
    renderList({
      categories: [makeCategory('c1', 'Обувь')],
      positionsByCategory: { c1: 2 },
      onReorderCategory,
    });
    await userEvent.click(screen.getByRole('button', { name: /Позиция 2/ }));
    expect(onReorderCategory).toHaveBeenCalledWith('c1');
  });
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { createCategoryInPlace } = vi.hoisted(() => ({
  createCategoryInPlace: vi.fn(),
}));

vi.mock('../../../application/hooks/useInventoryActions', () => ({
  useInventoryActions: () => ({ createCategoryInPlace }),
}));

import ProductCategoryPicker from './ProductCategoryPicker';
import type { InventoryCategoryItem } from '../../../application/hooks/useInventory';
import type { Category } from '../../../domain/models/category';

const CATEGORIES: InventoryCategoryItem[] = [
  {
    id: 'c1',
    name: 'Овощи',
    imageUrl: null,
    emoji: '📦',
    productCount: 2,
    archivedCount: 0,
    lowStockThreshold: 0,
    sortOrder: 1,
  },
];

const NEW_CATEGORY: Category = {
  id: 'new1',
  storeId: 's1',
  name: 'Фрукты',
  sortOrder: 2,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  imageStorageKey: null,
  lowStockThreshold: null,
};

function renderPicker() {
  const onChange = vi.fn();
  render(<ProductCategoryPicker categories={CATEGORIES} value="c1" onChange={onChange} />);
  return { onChange };
}

beforeEach(() => {
  createCategoryInPlace.mockReset().mockResolvedValue(NEW_CATEGORY);
});

describe('ProductCategoryPicker — создание категории из пикера', () => {
  it('по «+» открывает форму создания, создаёт и выбирает новую категорию', async () => {
    const { onChange } = renderPicker();

    await userEvent.click(screen.getByRole('button', { name: 'Категория' }));
    await userEvent.click(screen.getByRole('button', { name: 'Новая категория' }));

    await userEvent.type(screen.getByPlaceholderText('Например, Овощи'), 'Фрукты');
    await userEvent.click(screen.getByRole('button', { name: 'Создать категорию' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('new1'));
    await waitFor(() => expect(screen.queryByPlaceholderText('Например, Овощи')).toBeNull());
  });
});

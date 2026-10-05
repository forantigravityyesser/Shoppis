// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { updateCategory, deleteCategory, reorderCategory } = vi.hoisted(() => ({
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  reorderCategory: vi.fn(),
}));

vi.mock('../../../../application/hooks/useInventoryActions', () => ({
  useInventoryActions: () => ({ updateCategory, deleteCategory, reorderCategory }),
}));

import EditCategorySheet from './EditCategorySheet';
import type { InventoryCategoryItem } from '../../../../application/hooks/useInventory';

const CATEGORY: InventoryCategoryItem = {
  id: 'c1',
  name: 'Обувь',
  imageUrl: null,
  emoji: '📦',
  productCount: 3,
  archivedCount: 0,
  lowStockThreshold: 0,
  sortOrder: 1,
};

function renderSheet(orderPosition: number | null = 2, orderTotal = 5) {
  return render(
    <EditCategorySheet
      open
      category={CATEGORY}
      orderPosition={orderPosition}
      orderTotal={orderTotal}
      onClose={vi.fn()}
    />,
  );
}

beforeEach(() => {
  updateCategory.mockReset().mockResolvedValue(undefined);
  deleteCategory.mockReset().mockResolvedValue(true);
  reorderCategory.mockReset().mockResolvedValue(true);
});

describe('EditCategorySheet — порядок на витрине', () => {
  it('показывает текущую позицию и открывает реордер', async () => {
    renderSheet(2, 5);

    expect(screen.getByText('2 из 5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Изменить порядок' }));

    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
  });

  it('после успешного реордера закрывает пикер', async () => {
    renderSheet(2, 5);

    await userEvent.click(screen.getByRole('button', { name: 'Изменить порядок' }));
    await userEvent.click(screen.getByRole('button', { name: '3' }));

    await waitFor(() => expect(reorderCategory).toHaveBeenCalledWith('c1', 3));
    await waitFor(() => expect(screen.queryByRole('button', { name: '5' })).toBeNull());
  });

  it('при ошибке реордера показывает сообщение и оставляет пикер открытым', async () => {
    reorderCategory.mockResolvedValue(false);
    renderSheet(2, 5);

    await userEvent.click(screen.getByRole('button', { name: 'Изменить порядок' }));
    await userEvent.click(screen.getByRole('button', { name: '3' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось изменить порядок');
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
  });

  it('без позиции блок порядка не показывается', () => {
    renderSheet(null, 0);
    expect(screen.queryByText('Изменить порядок')).toBeNull();
  });
});

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
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  const utils = render(
    <EditCategorySheet
      open
      category={CATEGORY}
      orderPosition={orderPosition}
      orderTotal={orderTotal}
      onClose={onClose}
      onDeleted={onDeleted}
    />,
  );
  return { ...utils, onClose, onDeleted };
}

beforeEach(() => {
  updateCategory.mockReset().mockResolvedValue(undefined);
  deleteCategory.mockReset().mockResolvedValue(undefined);
  reorderCategory.mockReset().mockResolvedValue(undefined);
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
    reorderCategory.mockRejectedValue(new Error('boom'));
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

describe('EditCategorySheet — сохранение (docs/20 §6)', () => {
  it('успех: сохраняет и закрывает sheet', async () => {
    const { onClose } = renderSheet();

    const name = screen.getByDisplayValue('Обувь');
    await userEvent.clear(name);
    await userEvent.type(name, 'Обувь и аксессуары');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateCategory).toHaveBeenCalledTimes(1));
    expect(updateCategory).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ name: 'Обувь и аксессуары' }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('ошибка: sheet открыт, поля сохранены, повтор работает', async () => {
    updateCategory.mockRejectedValueOnce(new Error('boom'));
    const { onClose } = renderSheet();

    const name = screen.getByDisplayValue('Обувь');
    await userEvent.clear(name);
    await userEvent.type(name, 'Обувь+');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить категорию');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Обувь+')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe('EditCategorySheet — удаление (docs/20 §6)', () => {
  it('успех: onDeleted + onClose', async () => {
    const { onClose, onDeleted } = renderSheet();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить категорию' }));
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => expect(deleteCategory).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ошибка: сообщение, подтверждение остаётся, повтор работает', async () => {
    deleteCategory.mockRejectedValueOnce(new Error('boom'));
    const { onClose, onDeleted } = renderSheet();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить категорию' }));
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(await screen.findByText(/Не удалось удалить категорию/)).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    deleteCategory.mockResolvedValueOnce(undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });
});

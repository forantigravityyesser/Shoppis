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

import CreateCategorySheet from './CreateCategorySheet';
import type { Category } from '../../../domain/models/category';

const CATEGORY: Category = {
  id: 'new1',
  storeId: 's1',
  name: 'Овощи',
  sortOrder: 3,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  imageStorageKey: null,
  lowStockThreshold: null,
};

function renderSheet() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const utils = render(
    <CreateCategorySheet open onClose={onClose} onCreated={onCreated} />,
  );
  return { ...utils, onClose, onCreated };
}

beforeEach(() => {
  createCategoryInPlace.mockReset().mockResolvedValue(CATEGORY);
});

describe('CreateCategorySheet — создание из формы товара', () => {
  it('успех: создаёт категорию, отдаёт её наверх и закрывает sheet', async () => {
    const { onClose, onCreated } = renderSheet();

    await userEvent.type(screen.getByPlaceholderText('Например, Овощи'), 'Овощи');
    await userEvent.click(screen.getByRole('button', { name: 'Создать категорию' }));

    await waitFor(() =>
      expect(createCategoryInPlace).toHaveBeenCalledWith({
        name: 'Овощи',
        imageStorageKey: null,
      }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CATEGORY));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('кнопка заблокирована без названия', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'Создать категорию' })).toBeDisabled();
  });

  it('ошибка: sheet открыт, название сохранено, повтор работает', async () => {
    createCategoryInPlace.mockRejectedValueOnce(new Error('boom'));
    const { onClose, onCreated } = renderSheet();

    await userEvent.type(screen.getByPlaceholderText('Например, Овощи'), 'Овощи');
    await userEvent.click(screen.getByRole('button', { name: 'Создать категорию' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не удалось создать категорию',
    );
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Например, Овощи')).toHaveValue('Овощи');

    await userEvent.click(screen.getByRole('button', { name: 'Создать категорию' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CATEGORY));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

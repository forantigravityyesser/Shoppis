// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CategoryAddSheet from './CategoryAddSheet';
import type { InventoryProductItem } from '../../../../application/hooks/useInventory';

function makeProduct(id: string, title: string, categoryId: string | null = null): InventoryProductItem {
  return {
    id,
    categoryId,
    title,
    imageUrl: null,
    emoji: '📦',
    priceMinor: 10000,
    currency: 'RUB',
    stockAvailable: 1,
    stockHeld: 0,
    stockState: 'in_stock',
    status: 'ACTIVE',
    rating: 0,
    reviewsCount: 0,
    questionsCount: 0,
  };
}

function renderSheet(overrides: Partial<Parameters<typeof CategoryAddSheet>[0]> = {}) {
  const props = {
    open: true,
    categoryName: 'Обувь',
    products: [makeProduct('p1', 'Товар 1'), makeProduct('p2', 'Товар 2', 'c9')],
    existingIds: ['p1'],
    categoryNameById: { c1: 'Обувь', c9: 'Одежда' },
    onClose: vi.fn(),
    onCreateProduct: vi.fn(),
    onAssign: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { props, ...render(<CategoryAddSheet {...props} />) };
}

describe('CategoryAddSheet', () => {
  it('меню: «Новый товар» → onCreateProduct', async () => {
    const { props } = renderSheet();
    expect(screen.getByText('Добавить в «Обувь»')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Новый товар/ }));
    expect(props.onCreateProduct).toHaveBeenCalledTimes(1);
  });

  it('«Товар из магазина»: мультивыбор и добавление', async () => {
    const { props } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: /Товар из магазина/ }));

    // p1 уже в категории — заблокирован и отмечен
    expect(screen.getByRole('button', { name: /Товар 1/ })).toBeDisabled();
    expect(screen.getByText('уже здесь')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Товар 2/ }));
    await userEvent.click(screen.getByRole('button', { name: /Добавить \(1\)/ }));

    await waitFor(() => expect(props.onAssign).toHaveBeenCalledWith(['p2']));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it('поиск фильтрует список', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('button', { name: /Товар из магазина/ }));
    await userEvent.type(screen.getByPlaceholderText('Найти товар'), 'Товар 2');
    expect(screen.queryByText('Товар 1')).toBeNull();
    expect(screen.getByText('Товар 2')).toBeInTheDocument();
  });

  it('ошибка назначения: сообщение и sheet остаётся открытым', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onAssign = vi.fn().mockRejectedValue(new Error('boom'));
    const onClose = vi.fn();
    renderSheet({ onAssign, onClose });

    await userEvent.click(screen.getByRole('button', { name: /Товар из магазина/ }));
    await userEvent.click(screen.getByRole('button', { name: /Товар 2/ }));
    await userEvent.click(screen.getByRole('button', { name: /Добавить \(1\)/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось добавить товары');
    expect(onClose).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

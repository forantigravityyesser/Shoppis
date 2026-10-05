// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./InventoryProductRow', () => ({
  default: ({ product }: { product: { title: string } }) => <div>{product.title}</div>,
}));

import InventoryProductsSection from './InventoryProductsSection';
import type { InventoryProductItem } from '../../../../../application/hooks/useInventory';

function makeProduct(id: string, title: string): InventoryProductItem {
  return {
    id,
    categoryId: null,
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

function renderSection(products: InventoryProductItem[]) {
  return render(
    <InventoryProductsSection
      products={products}
      onOpenProduct={vi.fn()}
      onAddProduct={vi.fn()}
    />,
  );
}

describe('InventoryProductsSection', () => {
  it('пустой каталог → «Нет товаров» и действие', () => {
    renderSection([]);
    expect(screen.getByText('Нет товаров')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Добавить товар/ })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Найти товар')).toBeNull();
  });

  it('список товаров + поиск фильтрует', async () => {
    renderSection([makeProduct('p1', 'Морковь'), makeProduct('p2', 'Свёкла')]);
    expect(screen.getByText('Морковь')).toBeInTheDocument();
    expect(screen.getByText('Свёкла')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Найти товар'), 'мор');
    expect(screen.getByText('Морковь')).toBeInTheDocument();
    expect(screen.queryByText('Свёкла')).toBeNull();
  });

  it('поиск без результатов → «Ничего не найдено»', async () => {
    renderSection([makeProduct('p1', 'Морковь')]);
    await userEvent.type(screen.getByPlaceholderText('Найти товар'), 'zzz');
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    expect(screen.queryByText('Морковь')).toBeNull();
  });
});

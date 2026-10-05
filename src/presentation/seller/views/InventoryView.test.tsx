// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';

const { homeRef } = vi.hoisted(() => ({ homeRef: { current: {} as Record<string, unknown> } }));

vi.mock('../../../application/hooks/useInventory', () => ({
  useInventoryHome: () => homeRef.current,
  UNCATEGORIZED_ID: 'uncategorized',
}));

vi.mock('../../../application/hooks/useCategoryReorder', () => ({
  useCategoryReorder: () => ({ pending: false, error: null, reset: vi.fn(), reorder: vi.fn() }),
}));

vi.mock('../../../application/hooks/useInventoryActions', () => ({
  createProductPath: (id: string) => `/seller/inventory/product/new?categoryId=${id}`,
  useInventoryActions: () => ({ assignProductsToCategory: vi.fn() }),
}));

vi.mock('../../shared/components/BackButton', () => ({ default: () => null }));
vi.mock('../inventory/components/products/InventoryProductRow', () => ({ default: () => null }));
vi.mock('../inventory/components/CategoryGrid', () => ({
  default: () => <div>CATEGORIES_GRID</div>,
}));

import InventoryView from './InventoryView';

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

beforeEach(() => {
  homeRef.current = {
    categories: [],
    productsByCategory: {},
    uncategorized: null,
    allProducts: [],
    totals: { products: 0, categories: 0 },
    loading: false,
    error: null,
  };
});

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/seller/inventory']}>
      <InventoryView />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('InventoryView — секции', () => {
  it('по умолчанию открыта секция «Товары»', () => {
    renderView();
    expect(screen.getByRole('heading', { name: 'Товары' })).toBeInTheDocument();
    expect(screen.queryByText('CATEGORIES_GRID')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Товары' })).toHaveAttribute('aria-selected', 'true');
  });

  it('«+» в «Товарах» ведёт прямо в создание товара', async () => {
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/seller/inventory/product/new');
  });

  it('переключается на «Категории»; «+» ведёт прямо в создание категории', async () => {
    renderView();

    await userEvent.click(screen.getByRole('tab', { name: 'Категории' }));
    expect(screen.getByText('CATEGORIES_GRID')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Категории' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/seller/inventory/category/new');
  });
});

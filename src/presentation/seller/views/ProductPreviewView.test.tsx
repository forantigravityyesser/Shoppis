// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { inventoryState, productsState, navigate, linkProducts, unlinkProducts } = vi.hoisted(
  () => ({
    inventoryState: { current: {} as Record<string, unknown> },
    productsState: { current: {} as Record<string, unknown> },
    navigate: vi.fn(),
    linkProducts: vi.fn(),
    unlinkProducts: vi.fn(),
  }),
);

vi.mock('react-router', () => ({
  useParams: () => ({ productId: 'p1' }),
  useNavigate: () => navigate,
}));

vi.mock('../../../application/hooks/useInventory', () => ({
  useInventoryHome: () => inventoryState.current,
}));

vi.mock('../../../application/hooks/useProducts', () => ({
  useProducts: () => productsState.current,
}));

vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn(), notifySuccess: vi.fn() }),
}));

import ProductPreviewView from './ProductPreviewView';

const item = (id: string, title: string) => ({
  id,
  title,
  imageUrl: null,
  emoji: '📦',
  priceMinor: 1000,
  currency: 'USD',
  status: 'ACTIVE',
});

beforeEach(() => {
  navigate.mockReset();
  linkProducts.mockReset().mockResolvedValue(undefined);
  unlinkProducts.mockReset().mockResolvedValue(undefined);
  inventoryState.current = {
    allProducts: [item('p1', 'Текущий'), item('p2', 'Кроссовки'), item('p3', 'Кепка')],
    loading: false,
    error: null,
  };
  productsState.current = { productLinks: [], linkProducts, unlinkProducts };
});

describe('seller ProductPreviewView (Связи)', () => {
  it('loading → «Загрузка…»', () => {
    inventoryState.current = { ...inventoryState.current, loading: true };
    render(<ProductPreviewView />);
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });

  it('пусто → подсказка и кнопка «Добавить связь»', () => {
    render(<ProductPreviewView />);
    expect(screen.getByTestId('product-links')).toBeInTheDocument();
    expect(screen.getByText(/Пока нет связанных товаров/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить связь' })).toBeInTheDocument();
  });

  it('показывает связанные товары и убирает связь', async () => {
    productsState.current = {
      ...productsState.current,
      productLinks: [{ productId: 'p1', relatedProductId: 'p2' }],
    };
    render(<ProductPreviewView />);

    expect(screen.getByText('Кроссовки')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Убрать «Кроссовки»/ }));
    expect(unlinkProducts).toHaveBeenCalledWith('p1', 'p2');
  });

  it('в sheet «Связать» вызывает linkProducts', async () => {
    render(<ProductPreviewView />);
    await userEvent.click(screen.getByRole('button', { name: 'Добавить связь' }));

    // Кандидаты: p2 и p3 (текущий p1 исключён).
    expect(screen.getByPlaceholderText('Поиск товара')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Связать' })[0]);
    expect(linkProducts).toHaveBeenCalledWith('p1', 'p2');
  });
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Store construction reads the app language through deps(); only i18n is needed here.
const { updateProduct, fetchCatalog } = vi.hoisted(() => ({
  updateProduct: vi.fn(),
  fetchCatalog: vi.fn(),
}));

vi.mock('../../composition/container', () => ({
  deps: () => ({
    i18n: { getAppLanguage: () => 'ru', setAppLanguage: () => {} },
    productRepository: { updateProduct, fetchCatalog },
  }),
}));

import { useStore } from '../index';
import type { Product } from '../../../domain/models/product';

function product(id: string, categoryId: string | null): Product {
  return {
    id,
    storeId: 's1',
    productGroupId: null,
    categoryId,
    title: id,
    description: '',
    status: 'ACTIVE',
    sortOrder: 0,
    originalAmountMinor: 1000,
    discountPercent: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const EMPTY_CATALOG = {
  products: [],
  variants: [],
  inventories: [],
  images: [],
  attributes: [],
  linkAttributes: [],
  productLinks: [],
};

beforeEach(() => {
  updateProduct.mockReset().mockResolvedValue(undefined);
  fetchCatalog.mockReset().mockResolvedValue(EMPTY_CATALOG);
  useStore.setState({
    storeId: 's1',
    sessionToken: 'tok',
    products: [product('p1', null), product('p2', 'c9')],
  });
});

describe('product-slice.assignProductsCategory', () => {
  it('обновляет категорию выделенных и перечитывает каталог один раз', async () => {
    await useStore.getState().assignProductsCategory(['p1', 'p2'], 'c1');

    expect(updateProduct).toHaveBeenCalledWith('p1', { categoryId: 'c1' }, 'tok');
    expect(updateProduct).toHaveBeenCalledWith('p2', { categoryId: 'c1' }, 'tok');
    expect(fetchCatalog).toHaveBeenCalledTimes(1);
    expect(fetchCatalog).toHaveBeenCalledWith('s1');
  });

  it('пустой список — no-op', async () => {
    await useStore.getState().assignProductsCategory([], 'c1');
    expect(updateProduct).not.toHaveBeenCalled();
    expect(fetchCatalog).not.toHaveBeenCalled();
  });

  it('при ошибке откатывает оптимистичное состояние и бросает', async () => {
    updateProduct.mockRejectedValue(new Error('boom'));

    await expect(useStore.getState().assignProductsCategory(['p1'], 'c1')).rejects.toThrow('boom');

    expect(useStore.getState().products.find((p) => p.id === 'p1')?.categoryId).toBeNull();
    expect(fetchCatalog).not.toHaveBeenCalled();
  });
});

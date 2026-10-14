// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Store construction reads the app language through deps(); productRepository/storage are used by the slice.
const { updateProduct, addProduct, fetchCatalog, removeFilesByUrl } = vi.hoisted(() => ({
  updateProduct: vi.fn(),
  addProduct: vi.fn(),
  fetchCatalog: vi.fn(),
  removeFilesByUrl: vi.fn(),
}));

vi.mock('../../composition/container', () => ({
  deps: () => ({
    i18n: {
      getAppLanguage: () => 'ru',
      setAppLanguage: () => {},
      applyStoreDefaultLanguage: () => {},
    },
    productRepository: { updateProduct, addProduct, fetchCatalog },
    storage: { removeFilesByUrl },
  }),
}));

import { useStore } from '../index';
import type { NewProductInput } from '../../contracts/product';
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
  updateProduct.mockReset().mockResolvedValue([]);
  addProduct.mockReset().mockResolvedValue('new-1');
  fetchCatalog.mockReset().mockResolvedValue(EMPTY_CATALOG);
  removeFilesByUrl.mockReset().mockResolvedValue(undefined);
  useStore.setState({
    storeId: 's1',
    sessionToken: 'tok',
    products: [product('p1', null), product('p2', 'c9')],
    images: [],
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

describe('product-slice.saveProduct — создание/фото (docs/23 §6, §11, PC-06)', () => {
  const draftInput: NewProductInput = {
    storeId: 's1',
    title: 'Копия',
    description: '',
    originalAmountMinor: 1000,
    discountPercent: 0,
    categoryId: null,
    status: 'ACTIVE',
    images: [],
    variants: [
      {
        name: 'Размер',
        value: 'M',
        availableQuantity: 0,
        priceMode: 'USE_PRODUCT_PRICE',
        customOriginalAmountMinor: null,
        customDiscountPercent: null,
      },
    ],
    attributes: [],
    linkAttributes: [],
  };

  it('создаёт товар: возвращает новый id и не трогает Storage', async () => {
    addProduct.mockResolvedValue('new-1');

    const id = await useStore.getState().saveProduct(draftInput);

    expect(id).toBe('new-1');
    expect(addProduct).toHaveBeenCalledWith(draftInput, 'tok');
    expect(updateProduct).not.toHaveBeenCalled();
    expect(removeFilesByUrl).not.toHaveBeenCalled();
  });

  it('при редактировании чистит откреплённые фото, даже если каталог не загружен в стейт', async () => {
    // Прежние фото приходят из репозитория (БД), стейт `images` пуст.
    updateProduct.mockResolvedValue([
      { storageKey: 'a', thumbStorageKey: 'at' },
      { storageKey: 'b', thumbStorageKey: 'bt' },
    ]);

    await useStore
      .getState()
      .saveProduct({ id: 'p1', images: [{ storageKey: 'a', thumbStorageKey: 'at' }] });

    expect(updateProduct).toHaveBeenCalledWith(
      'p1',
      { images: [{ storageKey: 'a', thumbStorageKey: 'at' }] },
      'tok',
    );
    const removed = removeFilesByUrl.mock.calls[0][0] as Array<string | null>;
    expect(removed).toContain('b');
    expect(removed).toContain('bt');
    expect(removed).not.toContain('a');
    expect(removed).not.toContain('at');
  });

  it('не трогает Storage, если патч не меняет фото', async () => {
    await useStore.getState().saveProduct({ id: 'p1', title: 'новое' });

    expect(updateProduct).toHaveBeenCalledWith('p1', { title: 'новое' }, 'tok');
    expect(removeFilesByUrl).not.toHaveBeenCalled();
  });
});

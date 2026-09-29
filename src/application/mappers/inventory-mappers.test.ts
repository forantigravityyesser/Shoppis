import { describe, expect, it } from 'vitest';
import {
  belongsToSystemCategory,
  buildCategoryItem,
  buildProductDetail,
  buildProductItem,
  buildSystemCategoryItem,
  type InventoryCatalogSource,
} from './inventory-mappers';
import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from '../../domain/constants/categories';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../../domain/constants/limits';
import type { Category } from '../../domain/models/category';
import type {
  Inventory,
  Product,
  ProductAttribute,
  ProductImage,
  Variant,
} from '../../domain/models/product';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    storeId: 's1',
    productGroupId: null,
    categoryId: null,
    title: 'Товар',
    description: 'Описание',
    status: 'ACTIVE',
    sortOrder: 0,
    originalAmountMinor: 1000,
    discountPercent: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeVariant(overrides: Partial<Variant> = {}): Variant {
  return {
    id: 'v1',
    productId: 'p1',
    name: 'Объём',
    value: '1L',
    sortOrder: 0,
    status: 'ACTIVE',
    priceMode: 'USE_PRODUCT_PRICE',
    customOriginalAmountMinor: null,
    customDiscountPercent: null,
    ...overrides,
  };
}

function makeInventory(variantId: string, available: number, held = 0): Inventory {
  return { variantId, availableQuantity: available, heldQuantity: held };
}

function makeImage(overrides: Partial<ProductImage> = {}): ProductImage {
  return {
    id: 'img1',
    productId: 'p1',
    storageKey: 'full.jpg',
    thumbStorageKey: 'thumb.jpg',
    sortOrder: 0,
    ...overrides,
  };
}

function makeAttribute(overrides: Partial<ProductAttribute> = {}): ProductAttribute {
  return { id: 'a1', productId: 'p1', name: 'Цвет', value: 'Красный', sortOrder: 0, ...overrides };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'c1',
    storeId: 's1',
    name: 'Одежда',
    sortOrder: 0,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    imageStorageKey: null,
    lowStockThreshold: null,
    ...overrides,
  };
}

function makeSource(overrides: Partial<InventoryCatalogSource> = {}): InventoryCatalogSource {
  return { variants: [], inventories: [], images: [], attributes: [], ...overrides };
}

describe('belongsToSystemCategory', () => {
  it('treats null/undefined and system id as uncategorized', () => {
    expect(belongsToSystemCategory(null)).toBe(true);
    expect(belongsToSystemCategory(undefined)).toBe(true);
    expect(belongsToSystemCategory(UNCATEGORIZED_ID)).toBe(true);
    expect(belongsToSystemCategory('c1')).toBe(false);
  });
});

describe('buildCategoryItem', () => {
  it('maps a category with default threshold', () => {
    expect(buildCategoryItem(makeCategory(), 3, 1)).toEqual({
      id: 'c1',
      name: 'Одежда',
      imageUrl: null,
      emoji: '📦',
      productCount: 3,
      archivedCount: 1,
      lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
      sortOrder: 0,
    });
  });

  it('uses the category threshold and cover', () => {
    const item = buildCategoryItem(
      makeCategory({ lowStockThreshold: 2, imageStorageKey: 'cover.jpg' }),
      0,
    );
    expect(item.lowStockThreshold).toBe(2);
    expect(item.imageUrl).toBe('cover.jpg');
  });
});

describe('buildSystemCategoryItem', () => {
  it('builds the uncategorized item', () => {
    expect(buildSystemCategoryItem(4, 2, 99)).toEqual({
      id: UNCATEGORIZED_ID,
      name: UNCATEGORIZED_NAME,
      imageUrl: null,
      emoji: '📦',
      productCount: 4,
      archivedCount: 2,
      lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
      sortOrder: 99,
    });
  });
});

describe('buildProductItem', () => {
  it('uses the thumbnail for the list and computes price/stock', () => {
    const source = makeSource({
      images: [makeImage({ storageKey: 'full.jpg', thumbStorageKey: 'thumb.jpg' })],
      variants: [makeVariant({ id: 'v1' })],
      inventories: [makeInventory('v1', 3)],
    });
    const item = buildProductItem(
      makeProduct({ originalAmountMinor: 1000, discountPercent: 10 }),
      5,
      '₽',
      source,
    );
    expect(item.imageUrl).toBe('thumb.jpg');
    expect(item.priceMinor).toBe(900);
    expect(item.stockAvailable).toBe(3);
    expect(item.stockState).toBe('low_stock');
    expect(item.status).toBe('ACTIVE');
  });

  it('falls back to the full image when no thumbnail', () => {
    const source = makeSource({ images: [makeImage({ thumbStorageKey: null })] });
    expect(buildProductItem(makeProduct(), 5, '₽', source).imageUrl).toBe('full.jpg');
  });

  it('hides archived products regardless of stock', () => {
    const source = makeSource({
      variants: [makeVariant({ id: 'v1' })],
      inventories: [makeInventory('v1', 10)],
    });
    const item = buildProductItem(makeProduct({ status: 'ARCHIVED' }), 5, '₽', source);
    expect(item.stockState).toBe('hidden');
  });
});

describe('buildProductDetail', () => {
  it('maps variants with effective price, sorted attributes and images', () => {
    const source = {
      ...makeSource({
        variants: [
          makeVariant({ id: 'v2', value: '2L', sortOrder: 1 }),
          makeVariant({ id: 'v1', value: '1L', sortOrder: 0, status: 'ARCHIVED' }),
          makeVariant({
            id: 'v3',
            value: '3L',
            sortOrder: 2,
            priceMode: 'CUSTOM_PRICE',
            customOriginalAmountMinor: 2000,
            customDiscountPercent: 50,
          }),
        ],
        inventories: [makeInventory('v2', 4), makeInventory('v3', 0)],
        images: [makeImage({ storageKey: 'full.jpg', thumbStorageKey: 'thumb.jpg' })],
        attributes: [
          makeAttribute({ id: 'a2', name: 'Размер', sortOrder: 1 }),
          makeAttribute({ id: 'a1', name: 'Цвет', sortOrder: 0 }),
        ],
      }),
      categories: [makeCategory({ id: 'c1', name: 'Одежда' })],
    };
    const detail = buildProductDetail(makeProduct({ categoryId: 'c1' }), source, '₽');

    expect(detail.categoryName).toBe('Одежда');
    expect(detail.images).toEqual([{ url: 'full.jpg', thumbUrl: 'thumb.jpg' }]);
    expect(detail.attributes.map((a) => a.name)).toEqual(['Цвет', 'Размер']);
    expect(detail.variants.map((v) => v.id)).toEqual(['v2', 'v3']);
    expect(detail.variants[1]).toMatchObject({
      originalAmountMinor: 2000,
      priceMinor: 1000,
      discountPercent: 50,
    });
  });

  it('falls back to uncategorized name when category missing', () => {
    const detail = buildProductDetail(
      makeProduct({ categoryId: 'missing' }),
      { ...makeSource(), categories: [] },
      '₽',
    );
    expect(detail.categoryName).toBe(UNCATEGORIZED_NAME);
  });
});

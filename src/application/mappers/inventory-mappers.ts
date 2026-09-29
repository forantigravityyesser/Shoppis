import { UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from '../../domain/constants/categories';
import type { Category } from '../../domain/models/category';
import type {
  Inventory,
  Product,
  ProductAttribute,
  ProductImage,
  Variant,
} from '../../domain/models/product';
import type {
  InventoryCategoryItem,
  InventoryProductDetail,
  InventoryProductItem,
  InventoryVariantItem,
} from '../read-models/inventory-view';
import {
  lowStockThresholdFor,
  productStock,
  stockStateFor,
} from '../../domain/rules/inventory-rules';
import { currentPriceMinor, effectivePrice } from '../../domain/rules/product-rules';

const DEFAULT_EMOJI = '📦';

/** Товар относится к системной «Без категории» (явно или по legacy null). */
export function belongsToSystemCategory(categoryId: string | null | undefined): boolean {
  return categoryId == null || categoryId === UNCATEGORIZED_ID;
}

/** Источник строк каталога для сборки вью-моделей. */
export interface InventoryCatalogSource {
  variants: Variant[];
  inventories: Inventory[];
  images: ProductImage[];
  attributes?: ProductAttribute[];
}

function sortedImages(images: ProductImage[], productId: string): ProductImage[] {
  return images
    .filter((i) => i.productId === productId)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function buildCategoryItem(
  category: Category,
  productCount: number,
  archivedCount = 0,
): InventoryCategoryItem {
  return {
    id: category.id,
    name: category.name,
    imageUrl: category.imageStorageKey ?? null,
    emoji: DEFAULT_EMOJI,
    productCount,
    archivedCount,
    lowStockThreshold: lowStockThresholdFor(category),
    sortOrder: category.sortOrder,
  };
}

export function buildSystemCategoryItem(
  productCount: number,
  archivedCount: number,
  sortOrder: number,
): InventoryCategoryItem {
  return {
    id: UNCATEGORIZED_ID,
    name: UNCATEGORIZED_NAME,
    imageUrl: null,
    emoji: DEFAULT_EMOJI,
    productCount,
    archivedCount,
    lowStockThreshold: lowStockThresholdFor(null),
    sortOrder,
  };
}

export function buildProductItem(
  product: Product,
  threshold: number,
  currency: string,
  source: InventoryCatalogSource,
): InventoryProductItem {
  const stock = productStock(product.id, source.variants, source.inventories);
  const firstImage = sortedImages(source.images, product.id)[0];
  return {
    id: product.id,
    categoryId: product.categoryId,
    title: product.title,
    // Список грузит лёгкую миниатюру; у старых фото её нет → падаем на полный файл.
    imageUrl: firstImage ? (firstImage.thumbStorageKey ?? firstImage.storageKey) : null,
    emoji: DEFAULT_EMOJI,
    priceMinor: currentPriceMinor(product.originalAmountMinor, product.discountPercent),
    currency,
    stockAvailable: stock.available,
    stockHeld: stock.held,
    stockState:
      product.status === 'ARCHIVED' ? 'hidden' : stockStateFor(stock.available, threshold),
    status: product.status,
    rating: 0,
    reviewsCount: 0,
    questionsCount: 0,
  };
}

export function buildProductDetail(
  product: Product,
  source: InventoryCatalogSource & { categories: Category[] },
  currency: string,
): InventoryProductDetail {
  const category = source.categories.find((c) => c.id === product.categoryId) ?? null;
  const threshold = lowStockThresholdFor(category);
  const stock = productStock(product.id, source.variants, source.inventories);

  const variants: InventoryVariantItem[] = source.variants
    .filter((v) => v.productId === product.id && v.status === 'ACTIVE')
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => {
      const inventory = source.inventories.find((i) => i.variantId === v.id);
      const price = effectivePrice(v, product);
      return {
        id: v.id,
        name: v.name,
        value: v.value,
        originalAmountMinor: price.originalAmountMinor,
        priceMinor: price.currentAmountMinor,
        discountPercent: price.discountPercent,
        availableQuantity: inventory?.availableQuantity ?? 0,
        heldQuantity: inventory?.heldQuantity ?? 0,
      };
    });

  const attributes = (source.attributes ?? [])
    .filter((a) => a.productId === product.id)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((a) => ({ name: a.name, value: a.value }));

  return {
    id: product.id,
    categoryId: product.categoryId,
    categoryName: category?.name ?? UNCATEGORIZED_NAME,
    title: product.title,
    description: product.description,
    status: product.status,
    images: sortedImages(source.images, product.id).map((i) => ({
      url: i.storageKey,
      thumbUrl: i.thumbStorageKey,
    })),
    emoji: DEFAULT_EMOJI,
    originalAmountMinor: product.originalAmountMinor,
    discountPercent: product.discountPercent,
    priceMinor: currentPriceMinor(product.originalAmountMinor, product.discountPercent),
    currency,
    attributes,
    variants,
    stockAvailable: stock.available,
    stockHeld: stock.held,
    stockState:
      product.status === 'ARCHIVED' ? 'hidden' : stockStateFor(stock.available, threshold),
    rating: 0,
    reviewsCount: 0,
    questionsCount: 0,
  };
}

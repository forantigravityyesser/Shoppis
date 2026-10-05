import { useEffect, useMemo } from 'react';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../../domain/constants/limits';
import type { InventoryCategoryItem, InventoryProductItem } from '../read-models/inventory-view';
import { isSystemCategory } from '../../domain/rules/category-rules';
import { compareProductsForDisplay } from '../../domain/rules/product-rules';
import { useStore } from '../store';
import {
  belongsToSystemCategory,
  buildCategoryItem,
  buildProductItem,
  buildSystemCategoryItem,
  type InventoryCatalogSource,
} from '../mappers/inventory-mappers';

export interface CategoryPageData {
  category: InventoryCategoryItem | null;
  /** Активные + архивные товары категории (активные первыми). */
  products: InventoryProductItem[];
  /** Позиция категории на витрине (1-based) среди несистемных; null — не применимо. */
  orderPosition: number | null;
  /** Общее число несистемных категорий (для «N из M»). */
  orderTotal: number;
  loading: boolean;
  error: string | null;
}

/**
 * Данные экрана категории из реального стора. Системная «Без категории» строится
 * виртуально; архивные товары идут после активных.
 */
export function useCategoryPage(categoryId: string): CategoryPageData {
  const storeId = useStore((s) => s.storeId);
  const categories = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const variants = useStore((s) => s.variants);
  const inventories = useStore((s) => s.inventories);
  const images = useStore((s) => s.images);
  const catalogLoading = useStore((s) => s.catalogLoading);
  const categoriesLoading = useStore((s) => s.categoriesLoading);
  const catalogError = useStore((s) => s.catalogError);
  const categoriesError = useStore((s) => s.categoriesError);
  const currentStore = useStore((s) => s.currentStore);
  const ensureCatalog = useStore((s) => s.ensureCatalog);
  const ensureCategories = useStore((s) => s.ensureCategories);

  useEffect(() => {
    if (!storeId) return;
    void ensureCategories(storeId).catch(() => {});
    void ensureCatalog(storeId).catch(() => {});
  }, [storeId, ensureCategories, ensureCatalog]);

  const currency = currentStore?.currencyCode ?? 'USD';

  return useMemo(() => {
    const source: InventoryCatalogSource = { variants, inventories, images };
    const sorted = products.slice().sort(compareProductsForDisplay);
    const system = isSystemCategory(categoryId);
    const entity = system ? null : (categories.find((c) => c.id === categoryId) ?? null);

    const categoryProducts = sorted.filter((p) =>
      system ? belongsToSystemCategory(p.categoryId) : p.categoryId === categoryId,
    );
    const activeCount = categoryProducts.filter((p) => p.status === 'ACTIVE').length;
    const archivedCount = categoryProducts.filter((p) => p.status === 'ARCHIVED').length;

    const category = system
      ? buildSystemCategoryItem(activeCount, archivedCount, 0)
      : entity
        ? buildCategoryItem(entity, activeCount, archivedCount)
        : null;

    const threshold = category?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

    const userCategories = categories
      .filter((c) => !isSystemCategory(c.id))
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const orderTotal = userCategories.length;
    const orderIndex = entity ? userCategories.findIndex((c) => c.id === entity.id) : -1;
    const orderPosition = orderIndex >= 0 ? orderIndex + 1 : null;

    return {
      category,
      products: categoryProducts.map((p) => buildProductItem(p, threshold, currency, source)),
      orderPosition,
      orderTotal,
      loading: catalogLoading || categoriesLoading,
      error: catalogError ?? categoriesError ?? null,
    };
  }, [
    categoryId,
    categories,
    products,
    variants,
    inventories,
    images,
    currency,
    catalogLoading,
    categoriesLoading,
    catalogError,
    categoriesError,
  ]);
}

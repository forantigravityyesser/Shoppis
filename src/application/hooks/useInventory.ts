import { useEffect, useMemo } from 'react';
import { UNCATEGORIZED_ID } from '../../domain/constants/categories';
import type { Product } from '../../domain/models/product';
import type {
  InventoryCategoryItem,
  InventoryProductItem,
} from '../../domain/models/inventory-view';
import { resolveProductCategoryId } from '../../domain/rules/category-rules';
import { compareProductsForDisplay } from '../../domain/rules/product-rules';
import { useStore } from '../store';
import {
  buildCategoryItem,
  buildProductItem,
  buildSystemCategoryItem,
  type InventoryCatalogSource,
} from '../mappers/inventory-mappers';

export type { InventoryCategoryItem, InventoryProductItem };
export { UNCATEGORIZED_ID };

export interface InventoryTotals {
  /** Только активные товары. */
  products: number;
  /** Только пользовательские категории (системная «Без категории» не считается). */
  categories: number;
}

export interface InventoryHomeData {
  /** Все категории магазина, включая системную «Без категории» (она всегда последняя). */
  categories: InventoryCategoryItem[];
  productsByCategory: Record<string, InventoryProductItem[]>;
  uncategorized: InventoryCategoryItem | null;
  /** Активные + архивные товары (для поиска и превью). */
  allProducts: InventoryProductItem[];
  totals: InventoryTotals;
  loading: boolean;
  error: string | null;
}

/**
 * Данные Inventory Home из реального стора (InsForge). При наличии storeId
 * лениво догружает категории и каталог. Архивные товары показываются после активных.
 */
export function useInventoryHome(): InventoryHomeData {
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

    const userCategories = categories.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const userCategoryIds = userCategories.map((c) => c.id);
    /** Товар без валидной категории попадает в системную «Без категории». */
    const resolvedId = (categoryId: string | null): string =>
      resolveProductCategoryId(categoryId, userCategoryIds);

    const grouped = new Map<string, Product[]>();
    for (const product of sorted) {
      const id = resolvedId(product.categoryId);
      const list = grouped.get(id);
      if (list) list.push(product);
      else grouped.set(id, [product]);
    }
    const listFor = (id: string): Product[] => grouped.get(id) ?? [];
    const countActive = (list: Product[]): number =>
      list.filter((p) => p.status === 'ACTIVE').length;
    const countArchived = (list: Product[]): number =>
      list.filter((p) => p.status === 'ARCHIVED').length;

    const categoryItems: InventoryCategoryItem[] = userCategories.map((category) => {
      const list = listFor(category.id);
      return buildCategoryItem(category, countActive(list), countArchived(list));
    });

    const maxSortOrder = userCategories.reduce((max, c) => Math.max(max, c.sortOrder), -1);
    const uncategorizedList = listFor(UNCATEGORIZED_ID);
    const uncategorized = buildSystemCategoryItem(
      countActive(uncategorizedList),
      countArchived(uncategorizedList),
      maxSortOrder + 1,
    );

    const allCategoryItems = [...categoryItems, uncategorized];

    const productsByCategory: Record<string, InventoryProductItem[]> = {};
    for (const item of allCategoryItems) {
      const list = item.id === UNCATEGORIZED_ID ? uncategorizedList : listFor(item.id);
      productsByCategory[item.id] = list.map((p) =>
        buildProductItem(p, item.lowStockThreshold, currency, source),
      );
    }

    const allProducts = allCategoryItems.flatMap((item) => productsByCategory[item.id]);
    const activeTotal = allCategoryItems.reduce((sum, item) => sum + item.productCount, 0);

    return {
      categories: allCategoryItems,
      productsByCategory,
      uncategorized,
      allProducts,
      totals: { products: activeTotal, categories: categoryItems.length },
      loading: catalogLoading || categoriesLoading,
      error: catalogError ?? categoriesError ?? null,
    };
  }, [
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

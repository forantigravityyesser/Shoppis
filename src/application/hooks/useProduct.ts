import { useEffect, useMemo } from 'react';
import type {
  InventoryProductDetail,
  InventoryVariantItem,
} from '../../domain/models/inventory-view';
import { useStore } from '../store';
import { buildProductDetail, type InventoryCatalogSource } from '../mappers/inventory-mappers';

export type { InventoryProductDetail, InventoryVariantItem };

export interface ProductDetailData {
  product: InventoryProductDetail | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
}

/**
 * Детальные данные товара для ProductView из реального стора. Собирает варианты,
 * остатки, фото, характеристики и название категории. Лениво догружает каталог.
 */
export function useProductDetail(productId: string): ProductDetailData {
  const storeId = useStore((s) => s.storeId);
  const categories = useStore((s) => s.categories);
  const products = useStore((s) => s.products);
  const variants = useStore((s) => s.variants);
  const inventories = useStore((s) => s.inventories);
  const images = useStore((s) => s.images);
  const attributes = useStore((s) => s.attributes);
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
    const loading = catalogLoading || categoriesLoading;
    const error = catalogError ?? categoriesError ?? null;
    const product = products.find((p) => p.id === productId) ?? null;

    if (!product) {
      return { product: null, loading, error, notFound: !loading && !error };
    }

    const source: InventoryCatalogSource = { variants, inventories, images, attributes };
    return {
      product: buildProductDetail(product, { ...source, categories }, currency),
      loading,
      error,
      notFound: false,
    };
  }, [
    productId,
    categories,
    products,
    variants,
    inventories,
    images,
    attributes,
    currency,
    catalogLoading,
    categoriesLoading,
    catalogError,
    categoriesError,
  ]);
}

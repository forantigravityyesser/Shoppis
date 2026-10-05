import { useQuery } from '@tanstack/react-query';
import { deps } from '../composition/container';
import type { StorefrontCatalogPriceBounds } from '../read-models/storefront-catalog';

export interface StorefrontCatalogPriceBoundsState {
  /** Реальные границы цен магазина; null — ещё не загружены или магазин не найден. */
  bounds: StorefrontCatalogPriceBounds | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Границы актуальных цен магазина для слайдера фильтра
 * (`storefront_catalog_price_bounds_read`, store-wide, docs/17 §2.2). Кэш/ретраи —
 * на `QueryClient`; без `publicId` запрос отключён.
 */
export function useStorefrontCatalogPriceBounds(
  publicId: string | null,
  enabled = true,
): StorefrontCatalogPriceBoundsState {
  const queryEnabled = Boolean(publicId) && enabled;
  const query = useQuery({
    queryKey: ['storefront-catalog-price-bounds', publicId],
    queryFn: () => deps().storefrontCatalogRepository.loadCatalogPriceBounds(publicId as string),
    enabled: queryEnabled,
  });

  return {
    bounds: query.data ?? null,
    loading: queryEnabled && query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => {
      void query.refetch();
    },
  };
}

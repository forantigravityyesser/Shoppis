import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { deps } from '../composition/container';
import type { StorefrontProductCard } from '../read-models/storefront';

export interface StorefrontFavoriteProductsState {
  /** Товары избранного, отфильтрованные по актуальному `ids` и в его порядке. */
  products: StorefrontProductCard[];
  /** Первичная загрузка (данных ещё нет). */
  loading: boolean;
  /** Ошибка загрузки; товары сохраняются. */
  error: string | null;
  refresh: () => void;
}

/**
 * Гидрирует id избранного локального store (`favoritesByStore`) в карточки товаров
 * публичным read'ом (`storefront_favorite_products_read`). Query key включает `ids`,
 * поэтому добавление/удаление меняет набор. `keepPreviousData` держит предыдущие
 * карточки, пока грузится новый набор, — без мигания skeleton'а.
 *
 * Возвращаемый `products` всегда пересобирается из **живого** `ids`: снятый товар
 * исчезает немедленно (ещё до ответа сети), а id, которого нет в ответе (архив/удалён),
 * не создаёт фантомной карточки. `enabled=false` (напр. PAUSED магазин) отключает запрос.
 */
export function useStorefrontFavoriteProducts(
  publicId: string | null,
  ids: string[],
  enabled: boolean = true,
): StorefrontFavoriteProductsState {
  const queryEnabled = Boolean(publicId) && ids.length > 0 && enabled;

  const query = useQuery({
    queryKey: ['storefront-favorite-products', publicId, ids],
    queryFn: () => deps().storefrontCatalogRepository.loadProductsByIds(publicId as string, ids),
    enabled: queryEnabled,
    placeholderData: keepPreviousData,
  });

  const fetched = query.data ?? [];
  const byId = new Map(fetched.map((product) => [product.id, product]));
  const products = ids
    .map((id) => byId.get(id))
    .filter((product): product is StorefrontProductCard => product !== undefined);

  return {
    products,
    loading: queryEnabled && query.isLoading,
    error: queryEnabled && query.isError ? (query.error as Error).message : null,
    refresh: () => {
      void query.refetch();
    },
  };
}

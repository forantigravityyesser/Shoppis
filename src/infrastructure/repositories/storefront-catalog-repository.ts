import { insforge } from '../insforge/client';
import {
  mapStorefrontCatalogPriceBounds,
  mapStorefrontCatalogProductPage,
  mapStorefrontProductCardList,
} from '../../application/mappers/storefront-mappers';
import type { StorefrontProductCard } from '../../application/read-models/storefront';
import type {
  StorefrontCatalogPriceBounds,
  StorefrontCatalogProductPage,
  StorefrontCatalogQuery,
} from '../../application/read-models/storefront-catalog';

/**
 * Публичный read Каталога покупателя по opaque `public_id`. RPC-функции
 * (`storefront_catalog_products_read`, `storefront_catalog_price_bounds_read`)
 * сами применяют фильтры категории/поиска/цены, keyset-пагинацию и shop-boundary.
 * `null` — магазин не найден. docs/17 §2.
 */
export async function loadCatalogProducts(
  query: StorefrontCatalogQuery,
): Promise<StorefrontCatalogProductPage | null> {
  if (!query.publicId) return null;
  const { data, error } = await insforge.database.rpc('storefront_catalog_products_read', {
    p_public_id: query.publicId,
    p_category_id: query.categoryId ?? null,
    p_search: query.search ?? null,
    p_min_price: query.minPrice ?? null,
    p_max_price: query.maxPrice ?? null,
    p_cursor: query.cursor ?? null,
    p_limit: query.limit,
  });
  if (error) throw error;
  return mapStorefrontCatalogProductPage(data);
}

/**
 * Товары избранного по списку id (`storefront_favorite_products_read`). RPC сам
 * ограничивает выборку магазином/ACTIVE-товарами и отдаёт ту же карточку, что каталог.
 * `publicId` не задан или список пуст → без запроса.
 */
export async function loadProductsByIds(
  storePublicId: string,
  ids: string[],
): Promise<StorefrontProductCard[]> {
  if (!storePublicId || ids.length === 0) return [];
  const { data, error } = await insforge.database.rpc('storefront_favorite_products_read', {
    p_public_id: storePublicId,
    p_ids: ids,
  });
  if (error) throw error;
  return mapStorefrontProductCardList(data);
}

export async function loadCatalogPriceBounds(
  storePublicId: string,
): Promise<StorefrontCatalogPriceBounds | null> {
  if (!storePublicId) return null;
  const { data, error } = await insforge.database.rpc('storefront_catalog_price_bounds_read', {
    p_public_id: storePublicId,
  });
  if (error) throw error;
  return mapStorefrontCatalogPriceBounds(data);
}

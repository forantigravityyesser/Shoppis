import { insforge } from '../insforge/client';
import {
  mapPublicStoreContext,
  mapStorefrontHome,
  mapStorefrontHomeProductPage,
} from '../../application/mappers/storefront-mappers';
import type {
  StorefrontHome,
  StorefrontHomeProductPage,
} from '../../application/read-models/storefront';
import type { PublicStoreContext } from '../../application/read-models/public-store';

/**
 * Публичный storefront-read по opaque `public_id`. RPC-функции сами собирают
 * покупательскую проекцию; `null` — магазин не найден. docs/15 §4-6.
 */
export async function loadStorefrontHome(storePublicId: string): Promise<StorefrontHome | null> {
  if (!storePublicId) return null;
  const { data, error } = await insforge.database.rpc('storefront_home_context_read', {
    p_public_id: storePublicId,
  });
  if (error) throw error;
  return mapStorefrontHome(data);
}

/**
 * Страница товарного потока Home (`storefront_home_products_read`). Keyset-курсор
 * `cursor` (null — первая страница). `null` — магазин не найден.
 */
export async function loadStorefrontHomeProducts(
  storePublicId: string,
  cursor: string | null,
  limit: number,
): Promise<StorefrontHomeProductPage | null> {
  if (!storePublicId) return null;
  const { data, error } = await insforge.database.rpc('storefront_home_products_read', {
    p_public_id: storePublicId,
    p_cursor: cursor,
    p_limit: limit,
  });
  if (error) throw error;
  return mapStorefrontHomeProductPage(data);
}

/**
 * Минимальный публичный контекст магазина (без owner/private-полей). Резолвер
 * принимает opaque `public_id`; legacy-ссылки `store_<id>` резолвятся по
 * внутреннему id внутри SQL (docs/15 §4.2-4.3). `null` — магазин не найден.
 */
export async function loadPublicStoreContext(storeRef: string): Promise<PublicStoreContext | null> {
  if (!storeRef) return null;
  const { data, error } = await insforge.database.rpc('storefront_public_context_read', {
    p_store_ref: storeRef,
  });
  if (error) throw error;
  return mapPublicStoreContext(data);
}

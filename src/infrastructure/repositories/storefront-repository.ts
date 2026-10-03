import { insforge } from '../insforge/client';
import { mapStorefrontHome } from '../../application/mappers/storefront-mappers';
import type { StorefrontHome } from '../../application/read-models/storefront';

/**
 * Публичный storefront-read по opaque `public_id`. RPC-функция сама собирает
 * store + активные категории + активные карточки одним запросом и уже отдаёт
 * покупательскую проекцию (docs/13 §19-20). `null` — магазин не найден.
 */
export async function loadStorefrontHome(storePublicId: string): Promise<StorefrontHome | null> {
  if (!storePublicId) return null;
  const { data, error } = await insforge.database.rpc('storefront_home_read', {
    p_public_id: storePublicId,
  });
  if (error) throw error;
  return mapStorefrontHome(data);
}

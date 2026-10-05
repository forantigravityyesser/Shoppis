import { insforge } from '../insforge/client';
import { mapStorefrontCartItems } from '../../application/mappers/cart-mappers';
import type { CartItemRef, CartReadResult } from '../../application/read-models/cart';

/** Свежий пустой результат (не делим один мутабельный объект между вызовами). */
function emptyResult(): CartReadResult {
  return { store: null, items: [] };
}

/**
 * Публичный read корзины (`storefront_cart_items_read`, docs/18 §7). RPC сам
 * разрешает магазин по `public_id` и отдаёт проекцию каждой ссылки; чужие/битые
 * ссылки не матчатся (реконсиляция их удалит). `store === null` — магазин не найден.
 *
 * Без `publicId` или без ссылок запрос не отправляем (пустой результат).
 */
export async function loadCartItems(
  storePublicId: string,
  refs: CartItemRef[],
): Promise<CartReadResult> {
  if (!storePublicId || refs.length === 0) return emptyResult();

  const { data, error } = await insforge.database.rpc('storefront_cart_items_read', {
    p_public_id: storePublicId,
    p_items: refs.map((ref) => ({
      productId: ref.productId,
      variantId: ref.productVariantId,
    })),
  });
  if (error) throw error;

  return mapStorefrontCartItems(data) ?? emptyResult();
}

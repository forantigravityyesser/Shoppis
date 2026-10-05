import { insforge } from '../insforge/client';
import { mapStorefrontCartItems } from '../../application/mappers/cart-mappers';
import { MAX_CART_ITEMS } from '../../domain/constants/limits';
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
 *
 * Больше `MAX_CART_ITEMS` ссылок читаем чанками (RPC режет список на 100), чтобы
 * legacy-корзина не теряла позиции молча (docs/21 §3.5).
 */
export async function loadCartItems(
  storePublicId: string,
  refs: CartItemRef[],
): Promise<CartReadResult> {
  if (!storePublicId || refs.length === 0) return emptyResult();

  const chunks: CartItemRef[][] = [];
  for (let i = 0; i < refs.length; i += MAX_CART_ITEMS) {
    chunks.push(refs.slice(i, i + MAX_CART_ITEMS));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await insforge.database.rpc('storefront_cart_items_read', {
        p_public_id: storePublicId,
        p_items: chunk.map((ref) => ({
          productId: ref.productId,
          variantId: ref.productVariantId,
        })),
      });
      if (error) throw error;
      return mapStorefrontCartItems(data) ?? emptyResult();
    }),
  );

  const merged = emptyResult();
  for (const result of results) {
    if (!merged.store && result.store) merged.store = result.store;
    merged.items.push(...result.items);
  }
  return merged;
}

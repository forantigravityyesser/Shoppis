import type { CartItemRef, CartReadResult } from '../read-models/cart';

/**
 * Публичное чтение проекции корзины покупателя (docs/18 §7/§10). Один вызов =
 * одна серверная проекция по списку ссылок: товар/вариант/эффективная цена/наличие
 * и статус магазина. Реконсиляцию (что удалить/пометить) выполняет application-слой.
 *
 * `store === null` в результате — магазин не найден; вызывающий слой не применяет
 * удаления, чтобы не потерять корзину из-за сетевой/конфиг-ошибки.
 */
export interface CartRepository {
  loadCartItems(storePublicId: string, refs: CartItemRef[]): Promise<CartReadResult>;
}

export const MAX_CART_QTY = 99;
/** Максимум позиций (строк) в корзине; согласовано с cap'ом `storefront_cart_items_read` (docs/21 §3.5). */
export const MAX_CART_ITEMS = 100;
export const MAX_IMAGES = 4;
export const MAX_VARIANTS = 7;
export const SWIPE_DELETE_THRESHOLD = -80;
/** Порог low_stock по умолчанию, если у категории не задан свой. ADR-06.6 */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

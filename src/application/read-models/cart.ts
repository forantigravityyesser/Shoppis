import type { CartItem } from '../../domain/models/cart';
import type { StorefrontStore } from './storefront';

/**
 * Application-контракт вкладки Корзина покупателя (docs/18 §7). `CartItem` остаётся
 * минимальным (только ссылки/количество/снапшот цены/selected); всё продуктовое
 * приходит отдельной публичной проекцией `storefront_cart_items_read` — так Cart
 * не превращается во вторую базу товаров и не кэширует устаревший сток/цену.
 *
 * `CartItemView` — то, что нужно рендеру карточки корзины. `CartItemProjection` —
 * сырая проекция (включая не найденные ссылки) для реконсиляции.
 */

/** Ссылка на товар/вариант, которой оперирует корзина. */
export interface CartItemRef {
  productId: string;
  /** null — позиция без варианта (в MVP не создаётся; реконсиляция удаляет). */
  productVariantId: string | null;
}

/**
 * Buy-side позиция корзины: вариант гарантированно есть (в отличие от persisted
 * `CartItem`, где `productVariantId` nullable). Позиции без варианта реконсиляция
 * удаляет, поэтому до рендера они не доходят (docs/21 §6.1).
 */
export interface BuyerCartItem extends Omit<CartItem, 'productVariantId'> {
  productVariantId: string;
}

/**
 * Сырая публичная проекция одной ссылки корзины.
 * `productAvailable`/`variantAvailable` разделены, чтобы реконсиляция могла отличить
 * «товар пропал из витрины» от «вариант архивирован/удалён».
 */
export interface CartItemProjection {
  productId: string;
  variantId: string | null;
  /** Товар существует, ACTIVE и принадлежит магазину. */
  productAvailable: boolean;
  /** Вариант существует, ACTIVE и принадлежит товару. */
  variantAvailable: boolean;
  title: string;
  /** Лёгкая миниатюра (thumb), fallback — полное фото. */
  imageUrl: string | null;
  variantName: string | null;
  variantValue: string | null;
  /** Текущая effective price варианта, minor units; null — ссылка не разрешилась. */
  unitPrice: number | null;
  /** inventory.available_quantity; 0, если варианта/inventory нет. */
  availableQuantity: number;
}

/**
 * Публичный read корзины: магазин + проекции запрошенных ссылок.
 * `store === null` — магазин не найден/не разрешён (реконсиляцию не применяем).
 */
export interface CartReadResult {
  store: StorefrontStore | null;
  items: CartItemProjection[];
}

/** Рендер-модель карточки корзины: только разрешившиеся (ACTIVE) ссылки. */
export interface CartItemView {
  productId: string;
  productVariantId: string;

  title: string;
  imageUrl: string | null;

  variantName: string | null;
  variantValue: string | null;

  /** Текущая эффективная цена (minor units) — Cart price не авторитетен (docs/18 §8). */
  unitPrice: number;
  currencySymbol: string;

  availableQuantity: number;
  /** Для отрендеренной позиции всегда true (иначе она была бы удалена). */
  productAvailable: boolean;
  variantAvailable: boolean;
}

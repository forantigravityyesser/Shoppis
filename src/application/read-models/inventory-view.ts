import type { StockState } from '../../domain/rules/inventory-rules';
import type { ProductStatus, VariantPriceMode } from '../../domain/models/product';
import type { InheritanceMode } from '../rules/variant-form';

/** Изображение товара: полный URL (+ лёгкая миниатюра для списков). */
export interface InventoryImageItem {
  url: string;
  thumbUrl: string | null;
}

/** Плоский элемент категории для Inventory Home. */
export interface InventoryCategoryItem {
  id: string;
  name: string;
  imageUrl: string | null;
  emoji: string;
  /** Количество активных товаров категории. */
  productCount: number;
  /** Количество архивных товаров категории (показываются приглушённо). */
  archivedCount: number;
  lowStockThreshold: number;
  sortOrder: number;
}

/** Плоский элемент товара для CategoryView / мини-карточки. */
export interface InventoryProductItem {
  id: string;
  categoryId: string | null;
  title: string;
  imageUrl: string | null;
  emoji: string;
  priceMinor: number;
  currency: string;
  stockAvailable: number;
  stockHeld: number;
  stockState: StockState;
  status: ProductStatus;
  rating: number;
  reviewsCount: number;
  questionsCount: number;
}

/** Вариант товара с остатком для карточки товара и контроля остатков. */
export interface InventoryVariantItem {
  id: string;
  name: string;
  value: string;
  /** Цена до скидки (для предзаполнения формы редактирования). */
  originalAmountMinor: number;
  priceMinor: number;
  discountPercent: number;
  availableQuantity: number;
  heldQuantity: number;
  /** Режим цены варианта (для точного предзаполнения формы). */
  priceMode: VariantPriceMode;
  customOriginalAmountMinor: number | null;
  customDiscountPercent: number | null;
}

/** Детальная вью-модель товара для ProductView. */
export interface InventoryProductDetail {
  id: string;
  categoryId: string | null;
  categoryName: string;
  title: string;
  description: string;
  status: ProductStatus;
  images: InventoryImageItem[];
  emoji: string;
  originalAmountMinor: number;
  discountPercent: number;
  priceMinor: number;
  currency: string;
  attributes: Array<{ name: string; value: string }>;
  variants: InventoryVariantItem[];
  stockAvailable: number;
  stockHeld: number;
  stockState: StockState;
  rating: number;
  reviewsCount: number;
  questionsCount: number;
}

/** Нормализованный результат формы товара (создание/редактирование). */
export interface ProductFormPayload {
  title: string;
  description: string;
  categoryId: string;
  status: ProductStatus;
  images: InventoryImageItem[];
  attributes: Array<{ name: string; value: string }>;
  variants: Array<{
    /** id существующего варианта при редактировании (неразрушающий diff). */
    id?: string;
    name: string;
    value: string;
    quantity: number;
    priceMinor: number;
    discountPercent: number;
    /** Явный режим наследования цены/скидки от первого варианта. docs/19 §15. */
    priceMode: InheritanceMode;
    discountMode: InheritanceMode;
  }>;
}

/** Один вариант покупки при создании. Свои цена/скидка → CUSTOM_PRICE, иначе USE_PRODUCT_PRICE. */
export interface NewInventoryVariant {
  name: string;
  value: string;
  quantity: number;
  priceMinor: number;
  discountPercent: number;
}

/** Вход создания товара. Без вариантов доступен только архив. */
export interface NewInventoryProduct {
  title: string;
  description?: string;
  categoryId: string | null;
  status: ProductStatus;
  variants: NewInventoryVariant[];
  images?: string[];
  attributes?: Array<{ name: string; value: string }>;
  emoji?: string;
}

/** Патч редактирования товара: та же форма, что при создании. */
export type UpdateInventoryProductPatch = NewInventoryProduct;

/** Патч остатков варианта (контроль остатков). */
export interface UpdateVariantStockPatch {
  availableQuantity?: number;
  heldQuantity?: number;
}

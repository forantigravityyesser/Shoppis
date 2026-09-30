import type {
  Inventory,
  Product,
  ProductAttribute,
  ProductImage,
  ProductLinkAttribute,
  ProductStatus,
  Variant,
  VariantPriceMode,
  VariantStatus,
} from '../../domain/models/product';

/** Входное изображение товара: полный файл + опциональная миниатюра. */
export interface ProductImageInput {
  storageKey: string;
  thumbStorageKey?: string | null;
}

/**
 * Вариант при создании товара/добавлении.
 *
 * `id` присутствует только при редактировании существующего варианта — это
 * включает неразрушающий diff/upsert (варианты без `id` в патче → новые,
 * отсутствующие в патче существующие → архивируются).
 */
export interface NewVariantInput {
  id?: string;
  name: string;
  value: string;
  availableQuantity: number;
  priceMode?: VariantPriceMode;
  customOriginalAmountMinor?: number | null;
  customDiscountPercent?: number | null;
  status?: VariantStatus;
}

/** Вход создания товара. */
export interface NewProductInput {
  storeId: string;
  title: string;
  description: string;
  originalAmountMinor: number;
  discountPercent: number;
  categoryId: string | null;
  status?: ProductStatus;
  images: ProductImageInput[];
  variants: NewVariantInput[];
  attributes: Array<{ name: string; value: string }>;
  linkAttributes: Array<{ name: string; value: string }>;
}

/** Патч редактирования товара. */
export interface UpdateProductPatch {
  title?: string;
  description?: string;
  status?: ProductStatus;
  originalAmountMinor?: number;
  discountPercent?: number;
  categoryId?: string | null;
  images?: ProductImageInput[];
  variants?: NewVariantInput[];
  attributes?: Array<{ name: string; value: string }>;
  linkAttributes?: Array<{ name: string; value: string }>;
}

/** Патч остатков варианта (прямое редактирование). */
export interface VariantStockPatch {
  availableQuantity?: number;
  heldQuantity?: number;
}

/** Быстрое добавление одного варианта: базовые цена/скидка применяются первому варианту. */
export interface AddVariantInput extends NewVariantInput {
  baseOriginalAmountMinor?: number;
  baseDiscountPercent?: number;
}

/** Полный каталог витрины (без N+1), разложенный по сущностям. */
export interface ProductCatalog {
  products: Product[];
  variants: Variant[];
  inventories: Inventory[];
  images: ProductImage[];
  attributes: ProductAttribute[];
  linkAttributes: ProductLinkAttribute[];
}

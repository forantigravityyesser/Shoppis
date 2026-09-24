export type ProductStatus = 'ACTIVE' | 'ARCHIVED';
export type VariantStatus = 'ACTIVE' | 'ARCHIVED';
export type VariantPriceMode = 'USE_PRODUCT_PRICE' | 'CUSTOM_PRICE';

export interface Product {
  id: string;
  storeId: string;
  productGroupId: string | null;
  categoryId: string | null;
  title: string;
  description: string;
  status: ProductStatus;
  sortOrder: number;
  /** Изначальная цена продавца в minor units. 03 §6, §10 */
  originalAmountMinor: number;
  /** Скидка 0..100. Текущая цена считается сервером. 03 §10 */
  discountPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  storageKey: string;
  sortOrder: number;
}

export interface ProductAttribute {
  id: string;
  productId: string;
  name: string;
  value: string;
  sortOrder: number;
}

export interface ProductLinkAttribute {
  id: string;
  productId: string;
  name: string;
  value: string;
  sortOrder: number;
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  value: string;
  sortOrder: number;
  status: VariantStatus;
  priceMode: VariantPriceMode;
  customOriginalAmountMinor: number | null;
  customDiscountPercent: number | null;
}

export interface Inventory {
  variantId: string;
  availableQuantity: number;
  heldQuantity: number;
}

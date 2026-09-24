export interface Product {
  id: string;
  storeId: string;
  title: string;
  description: string;
  /** Продажная цена (после % скидки) — то, что платит покупатель */
  price: number;
  /** Изначальная цена продавца (истина) — показывается зачёркнутой */
  oldPrice: number | null;
  /** Скидка в процентах: 0–100, задаётся только на товар */
  discountPercent: number;
  categoryId: string | null;
  imageUrl: string;
  imageUrls: string[];
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  size: string;
  stockQuantity: number;
}

export interface ProductCharacteristic {
  id: string;
  productId: string;
  label: string;
  value: string;
}

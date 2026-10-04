import type { StoreCurrency, StoreStatus } from '../../domain/models/store';

/**
 * Публичный storefront покупателя разделён на две части (docs/15 §5.6):
 *  - `StorefrontHome` — статичный контекст (store + категории): малый, редко меняется;
 *  - `StorefrontHomeProductPage` — товарный поток: большой, пагинируется.
 * Здесь только то, что разрешено покупателю: без вариантов, inventory и attributes.
 */

/** Статичный контекст витрины: магазин + активные категории. */
export interface StorefrontHome {
  store: StorefrontStore;
  categories: StorefrontCategory[];
}

/** Страница товарного потока Home с keyset-курсором следующей страницы. */
export interface StorefrontHomeProductPage {
  products: StorefrontProductCard[];
  /** null — страниц больше нет. */
  nextCursor: string | null;
}

export interface StorefrontStore {
  id: string;
  publicId: string;
  name: string;
  bannerUrl: string | null;
  status: StoreStatus;
  currencyCode: StoreCurrency;
  currencySymbol: string;
}

export interface StorefrontCategory {
  id: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
}

export interface StorefrontProductCard {
  id: string;
  title: string;
  /** null, если категория не ACTIVE (архивная) или удалена. */
  categoryId: string | null;
  /** Лёгкая миниатюра (thumb), fallback — полное фото. */
  imageUrl: string | null;
  /** Effective price первого активного варианта, minor units (только конечная цена). */
  price: number;
  /** false — все активные варианты закончились (карточка остаётся видимой). */
  available: boolean;
}

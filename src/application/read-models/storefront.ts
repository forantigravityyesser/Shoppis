import type { StoreCurrency, StoreStatus } from '../../domain/models/store';

/**
 * Публичная storefront-модель покупателя. Projection приходит из
 * `storefront_home_read(public_id)` одним запросом (docs/13 §19-21, docs/03 §29).
 * Здесь только то, что разрешено покупателю: без вариантов, inventory и attributes.
 */
export interface StorefrontHome {
  store: StorefrontStore;
  categories: StorefrontCategory[];
  products: StorefrontProductCard[];
}

export interface StorefrontStore {
  id: string;
  publicId: string;
  name: string;
  bannerUrl: string | null;
  /** Аватар продавца из Telegram `photo_url`; null → fallback по первой букве. */
  sellerAvatarUrl: string | null;
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
  /** Effective price первого активного варианта, minor units. */
  price: number;
  /** Цена до скидки, только если скидка > 0; иначе null. */
  originalPrice: number | null;
  /** false — все активные варианты закончились (карточка остаётся видимой). */
  available: boolean;
}

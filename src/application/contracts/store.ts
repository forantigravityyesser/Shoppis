import type { StoreCurrency, StoreLanguage } from '../../domain/models/store';

/** Создание витрины из формы онбординга (локальный/dev путь). */
export interface CreateStoreInput {
  ownerTelegramId: string;
  name: string;
  currency: StoreCurrency;
  language: StoreLanguage;
  bannerUrl?: string;
  description?: string;
}

/** Патч профиля витрины. */
export interface StoreProfilePatch {
  name?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  supportHandle?: string;
  currency?: StoreCurrency;
  currencySymbol?: string;
  language?: StoreLanguage;
}

/** Payload edge-функции shop-create. */
export interface CreateShopPayload {
  name: string;
  currency: string;
  language: string;
  bannerUrl?: string;
}

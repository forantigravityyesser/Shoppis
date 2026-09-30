import type { StoreCurrency, StoreLanguage, StoreStatus } from '../../domain/models/store';

/** Создание витрины из формы онбординга (локальный/dev путь). */
export interface CreateStoreInput {
  ownerTelegramId: string;
  name: string;
  currency: StoreCurrency;
  language: StoreLanguage;
  bannerUrl?: string;
  description?: string;
}

/** Payload edge-функции shop-create. */
export interface CreateShopPayload {
  name: string;
  currency: string;
  language: string;
  bannerUrl?: string;
}

/**
 * Патчи профиля витрины по блокам настроек. Каждый блок сохраняет только свои поля,
 * поэтому `update-profile` отправляет частичный patch. 12 §4.2.
 */

/** Идентификация: название и баннер. */
export interface StoreIdentityPatch {
  name?: string;
  bannerUrl?: string;
}

/** Локализация: валюта и язык. Символ валюты выводится из кода, не передаётся. */
export interface StoreLocalizationPatch {
  currency?: StoreCurrency;
  language?: StoreLanguage;
}

/** Контакт для связи (продавец / менеджер / бот). */
export interface StoreContactPatch {
  supportHandle?: string;
}

export type StoreProfilePatch = StoreIdentityPatch &
  StoreLocalizationPatch &
  StoreContactPatch;

/** Операционное изменение статуса — отдельно от profile patch. 12 §4.2 */
export interface StoreStatusPatch {
  status: StoreStatus;
}

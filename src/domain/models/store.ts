/** Язык витрины/приложения. Дублируется в БД на этапе бэкенда. */
export type StoreLanguage = 'ru' | 'en';

/** Валюты витрины. Конвертаций нет — меняется только значок. */
export type StoreCurrency = 'USD' | 'RUB' | 'BYN';

/** Статус магазина. PAUSED блокирует новые заказы. 02 §13 */
export type StoreStatus = 'ACTIVE' | 'PAUSED';

export interface Store {
  id: string;
  ownerUserId: string | null;
  ownerTelegramId: string;
  name: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  supportHandle: string;
  /** Код валюты. Конвертаций нет — меняется только значок */
  currencyCode: StoreCurrency;
  currencySymbol: string;
  language: StoreLanguage;
  status: StoreStatus;
  /** Opaque публичный идентификатор витрины. 03 §26 */
  publicId: string;
  createdAt: string;
}

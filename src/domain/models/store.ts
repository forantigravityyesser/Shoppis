export interface LoyaltyLevel {
  rank: number;
  name: string;
  conditionType: string;
  conditionValue: number;
  rewardCode: string;
  rewardDiscount: number;
}

/** Язык витрины/приложения. Дублируется в БД на этапе бэкенда. */
export type StoreLanguage = 'ru' | 'en';

/** Валюты витрины. Конвертаций нет — меняется только значок. */
export type StoreCurrency = 'USD' | 'RUB' | 'BYN';

export interface Store {
  id: string;
  ownerTelegramId: string;
  name: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  supportHandle: string;
  /** Код валюты. Конвертаций нет — меняется только значок */
  currency: StoreCurrency;
  currencySymbol: string;
  language: StoreLanguage;
  createdAt: string;
}

export interface StoreSettings {
  loyaltyLevels: LoyaltyLevel[];
}

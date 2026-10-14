import type { AppLanguage } from '../contracts/i18n';

export interface I18nPort {
  getAppLanguage(): AppLanguage;
  /** Явная смена языка пользователем (персистится). */
  setAppLanguage(lang: AppLanguage): void;
  /** Язык магазина как дефолт витрины — применяется, только если выбора не было. */
  applyStoreDefaultLanguage(lang: AppLanguage): void;
}

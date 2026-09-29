import type { AppLanguage } from '../contracts/i18n';

export interface I18nPort {
  getAppLanguage(): AppLanguage;
  setAppLanguage(lang: AppLanguage): void;
}

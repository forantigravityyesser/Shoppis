import 'i18next';
import type ru from './locales/ru.json';

/**
 * Типизация ключей переводов: источник истины — структура `locales/ru.json`.
 * `t('seller.dashboard.title')` проверяется компилятором; опечатки ловит
 * `npm run typecheck`. Английская локаль обязана повторять структуру (тест
 * паритета ключей на этапе QA).
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof ru;
    };
  }
}

import en from './locales/en.json';
import ru from './locales/ru.json';

/**
 * Ресурсы переводов для i18next. `defaultNS: 'translation'` — поэтому весь
 * контент локали лежит под ключом `translation` (неймспейсы внутри — обычные
 * ключи вида `seller.dashboard.title`).
 */
export const resources = {
  ru: { translation: ru },
  en: { translation: en },
} as const;

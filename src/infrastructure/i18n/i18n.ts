import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getTelegramUser } from '../telegram/telegram-app';
import en from './locales/en.json';
import ru from './locales/ru.json';

export const SUPPORTED_LANGUAGES = ['ru', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'shoppis-language';

function telegramHint(): AppLanguage | null {
  const code = getTelegramUser()?.languageCode ?? '';
  if (code.toLowerCase().startsWith('ru')) return 'ru';
  if (code) return 'en';
  return null;
}

/** saved → приветственный выбор → язык TG → ru */
export function detectLanguage(): AppLanguage {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'ru' || saved === 'en') return saved;
  return telegramHint() ?? 'ru';
}

export async function initI18n(): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
    },
    lng: detectLanguage(),
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
  });
}

/**
 * Смена языка: мгновенно + сохранение на устройстве.
 * TODO (этап БД): дублировать выбор в БД, чтобы не слетал на новом устройстве.
 */
export function setAppLanguage(lang: AppLanguage): void {
  localStorage.setItem(STORAGE_KEY, lang);
  void i18n.changeLanguage(lang);
}

export function getAppLanguage(): AppLanguage {
  return i18n.language === 'en' ? 'en' : 'ru';
}

export { i18n };

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getTelegramUser } from '../telegram/telegram-app';
import type { AppLanguage } from '../../application/contracts/i18n';
import { resources } from './resources';

export { SUPPORTED_LANGUAGES, type AppLanguage } from '../../application/contracts/i18n';

/** Явный выбор пользователя хранится под этим ключом; наличие ключа = выбор сделан. */
const STORAGE_KEY = 'shoppis-language';

/** Явный выбор языка пользователем (localStorage), либо null, если выбора не было. */
export function getStoredLanguage(): AppLanguage | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {
    // localStorage недоступен (напр. не-DOM окружение) — считаем, что выбора нет.
  }
  return null;
}

/** Язык из профиля Telegram; `en` для любого не-русского кода. */
function telegramHint(): AppLanguage | null {
  const code = getTelegramUser()?.languageCode ?? '';
  if (!code) return null;
  return code.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/**
 * Порядок определения языка интерфейса:
 *   явный выбор → язык магазина (витрина) → язык Telegram → ru.
 * `storeDefault` передаётся только в buyer-контексте и только пока пользователь
 * не сделал явный выбор.
 */
export function resolveLanguage(storeDefault?: AppLanguage | null): AppLanguage {
  return getStoredLanguage() ?? storeDefault ?? telegramHint() ?? 'ru';
}

/** Совместимость: стартовое определение языка при инициализации. */
export function detectLanguage(): AppLanguage {
  return resolveLanguage();
}

/** Синхронизирует `<html lang>` с активным языком (a11y/SEO/шрифты). */
function syncDocumentLang(lang: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
}

export async function initI18n(): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources,
    lng: detectLanguage(),
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
  });
  syncDocumentLang(getAppLanguage());
}

/**
 * Явная смена языка пользователем: мгновенно + сохранение на устройстве.
 * TODO (этап БД): дублировать выбор в БД, чтобы не слетал на новом устройстве.
 */
export function setAppLanguage(lang: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // нет storage — язык всё равно применим в текущей сессии.
  }
  void i18n.changeLanguage(lang);
  syncDocumentLang(lang);
}

/**
 * Язык магазина как дефолт витрины: применяется только если пользователь ещё
 * не сделал явный выбор (иначе его предпочтение неприкосновенно).
 */
export function applyStoreDefaultLanguage(lang: AppLanguage): void {
  if (getStoredLanguage()) return;
  if (getAppLanguage() === lang) return;
  void i18n.changeLanguage(lang);
  syncDocumentLang(lang);
}

export function getAppLanguage(): AppLanguage {
  const resolved = i18n.resolvedLanguage ?? i18n.language ?? '';
  return resolved.startsWith('en') ? 'en' : 'ru';
}

export { i18n };

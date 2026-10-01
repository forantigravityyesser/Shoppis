function optional(name: string, fallback = ''): string {
  const value = import.meta.env[name] as string | undefined;
  return value ?? fallback;
}

export const INSFORGE_URL = optional('VITE_INSForge_URL', 'https://your-app.region.insforge.app');
export const INSFORGE_ANON_KEY = optional('VITE_INSForge_ANON_KEY');
export const BUYER_BOT_USERNAME = optional('VITE_BUYER_BOT_USERNAME', 'BuyShoppis_bot');

/**
 * Short name именованного Mini App из BotFather: только `[a-z0-9_]{3,30}`.
 * Невалидное значение (напр. с заглавными буквами) игнорируется — берём дефолт,
 * чтобы устаревший env не ломал публичную ссылку.
 */
function normalizeAppShortname(value: string): string {
  const v = String(value ?? '')
    .trim()
    .replace(/^\/+/, '');
  return /^[a-z0-9_]{3,30}$/.test(v) ? v : '';
}

/** Именованное Mini App витрины (Direct Link): `t.me/<bot>/<app>?startapp=...`. */
export const BUYER_APP_SHORTNAME =
  normalizeAppShortname(optional('VITE_BUYER_APP_SHORTNAME', '')) || 'shop';

/** Публичный бакет для изображений товаров и логотипов */
export const MEDIA_BUCKET = 'shoppis-media';

/**
 * Явный dev-режим авторизации. В нём допускается mock identity, когда Mini App
 * открыт вне Telegram. В production-сборке всегда false.
 * Переопределение: VITE_DEV_AUTH_MODE=true|false.
 */
export const DEV_AUTH_MODE =
  (import.meta.env.VITE_DEV_AUTH_MODE as string | undefined) === 'true' ||
  (import.meta.env.DEV && (import.meta.env.VITE_DEV_AUTH_MODE as string | undefined) !== 'false');

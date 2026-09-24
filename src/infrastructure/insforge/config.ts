function optional(name: string, fallback = ''): string {
  const value = import.meta.env[name] as string | undefined;
  return value ?? fallback;
}

export const INSFORGE_URL = optional(
  'VITE_INSForge_URL',
  'https://your-app.region.insforge.app',
);
export const INSFORGE_ANON_KEY = optional('VITE_INSForge_ANON_KEY');
export const BUYER_BOT_USERNAME = optional('VITE_BUYER_BOT_USERNAME', 'buyer_bot_name');
export const BUYER_APP_SHORTNAME = optional('VITE_BUYER_APP_SHORTNAME', 'app');

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

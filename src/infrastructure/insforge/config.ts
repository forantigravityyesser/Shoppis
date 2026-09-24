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

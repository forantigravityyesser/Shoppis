/**
 * Публичная ссылка на витрину — прямой deep link в Mini App (первый шаг для
 * покупателя всегда приложение, а не чат бота).
 * Формат: `https://t.me/<bot>/<app>?startapp=shop_<public_id>`.
 * `public_id` — opaque (`03 §26`), внутренний UUID наружу не отдаём. 04 §19, 12 §5.4.
 */
export const STOREFRONT_START_PREFIX = 'shop_';
/** Legacy-префикс (`store_`) — только чтение для старых ссылок; в новых не используем. */
export const LEGACY_STOREFRONT_START_PREFIX = 'store_';

export interface StorefrontLinkParts {
  botUsername: string;
  /**
   * Короткое имя именованного Mini App из BotFather (Direct Link).
   * Пусто → ссылка на Main Mini App: `t.me/<bot>?startapp=...`.
   */
  appShortname?: string;
  publicId: string;
}

function normalizeBotUsername(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/^@/, '');
}

/** Short name Mini App: BotFather допускает только строчные латинские/цифры/`_`. */
function normalizeAppShortname(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase();
}

/** `startapp`-значение: `shop_<public_id>`. */
export function buildStorefrontStartParam(publicId: string): string {
  return `${STOREFRONT_START_PREFIX}${publicId}`;
}

/**
 * Полная публичная ссылка на витрину — открывает Mini App напрямую.
 * С именованным app: `https://t.me/<bot>/<app>?startapp=shop_<public_id>`.
 * Без app (Main Mini App): `https://t.me/<bot>?startapp=shop_<public_id>`.
 */
export function buildStorefrontLink({
  botUsername,
  appShortname,
  publicId,
}: StorefrontLinkParts): string {
  const bot = normalizeBotUsername(botUsername);
  const app = normalizeAppShortname(appShortname);
  const base = app ? `https://t.me/${bot}/${app}` : `https://t.me/${bot}`;
  return `${base}?startapp=${buildStorefrontStartParam(publicId)}`;
}

/** Обратный разбор `startapp`: возвращает `public_id` или null. */
export function parseStorefrontStartParam(param: string | null | undefined): string | null {
  if (!param || !param.startsWith(STOREFRONT_START_PREFIX)) return null;
  const publicId = param.slice(STOREFRONT_START_PREFIX.length);
  return publicId || null;
}

/**
 * Разбор legacy `store_<id>` (старые ссылки ботов). Возвращает сырое значение
 * (public_id или внутренний id) — резолв выполняет загрузчик витрины. Может быть
 * удалено, когда все внешние ссылки перейдут на `shop_<public_id>`.
 */
export function parseLegacyStoreStartParam(param: string | null | undefined): string | null {
  if (!param || !param.startsWith(LEGACY_STOREFRONT_START_PREFIX)) return null;
  const value = param.slice(LEGACY_STOREFRONT_START_PREFIX.length);
  return value || null;
}

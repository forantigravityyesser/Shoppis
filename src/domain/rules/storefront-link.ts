/**
 * Публичная ссылка на витрину — прямой deep link в Mini App (первый шаг для
 * покупателя всегда приложение, а не чат бота).
 * Формат: `https://t.me/<bot>/<app>?startapp=shop_<public_id>`.
 * `public_id` — opaque (`03 §26`), внутренний UUID наружу не отдаём. 04 §19, 12 §5.4.
 */
export const STOREFRONT_START_PREFIX = 'shop_';
/** Legacy-префикс (`store_`) — только чтение для старых ссылок; в новых не используем. */
export const LEGACY_STOREFRONT_START_PREFIX = 'store_';
/**
 * Префикс товарного deep-link: `prod_<public_id>_<product_id>`. Ведёт на
 * конкретный товар витрины (открывает Mini App и карточку товара). `public_id`
 * — 32 hex без `_`, поэтому первый `_` после префикса однозначно разделяет части.
 */
export const PRODUCT_START_PREFIX = 'prod_';

export interface StorefrontLinkParts {
  botUsername: string;
  /**
   * Короткое имя именованного Mini App из BotFather (Direct Link).
   * Пусто → ссылка на Main Mini App: `t.me/<bot>?startapp=...`.
   */
  appShortname?: string;
  publicId: string;
}

export interface StorefrontProductLinkParts extends StorefrontLinkParts {
  productId: string;
}

/** Разобранный товарный `startapp`-параметр. */
export interface ParsedProductStartParam {
  publicId: string;
  productId: string;
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

/** `startapp`-значение товара: `prod_<public_id>_<product_id>`. */
export function buildProductStartParam(publicId: string, productId: string): string {
  return `${PRODUCT_START_PREFIX}${publicId}_${productId}`;
}

/** База прямой ссылки на Mini App: `https://t.me/<bot>/<app>` (или `t.me/<bot>`). */
function storefrontBase(botUsername: string, appShortname?: string): string {
  const bot = normalizeBotUsername(botUsername);
  const app = normalizeAppShortname(appShortname);
  return app ? `https://t.me/${bot}/${app}` : `https://t.me/${bot}`;
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
  return `${storefrontBase(botUsername, appShortname)}?startapp=${buildStorefrontStartParam(publicId)}`;
}

/**
 * Публичная ссылка на конкретный товар — открывает Mini App и карточку товара:
 * `https://t.me/<bot>/<app>?startapp=prod_<public_id>_<product_id>`.
 */
export function buildStorefrontProductLink({
  botUsername,
  appShortname,
  publicId,
  productId,
}: StorefrontProductLinkParts): string {
  return `${storefrontBase(botUsername, appShortname)}?startapp=${buildProductStartParam(
    publicId,
    productId,
  )}`;
}

/** Обратный разбор `startapp`: возвращает `public_id` или null. */
export function parseStorefrontStartParam(param: string | null | undefined): string | null {
  if (!param || !param.startsWith(STOREFRONT_START_PREFIX)) return null;
  const publicId = param.slice(STOREFRONT_START_PREFIX.length);
  return publicId || null;
}

/**
 * Обратный разбор товарного `startapp` (`prod_<public_id>_<product_id>`).
 * null — не товарная ссылка или пустые части.
 */
export function parseProductStartParam(
  param: string | null | undefined,
): ParsedProductStartParam | null {
  if (!param || !param.startsWith(PRODUCT_START_PREFIX)) return null;
  const rest = param.slice(PRODUCT_START_PREFIX.length);
  const sep = rest.indexOf('_');
  if (sep <= 0 || sep === rest.length - 1) return null;
  const publicId = rest.slice(0, sep);
  const productId = rest.slice(sep + 1);
  return publicId && productId ? { publicId, productId } : null;
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

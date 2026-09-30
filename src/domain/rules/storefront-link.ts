/**
 * Публичная ссылка на витрину — прямой deep link в Mini App (первый шаг для
 * покупателя всегда приложение, а не чат бота).
 * Формат: `https://t.me/<bot>/<app>?startapp=shop_<public_id>`.
 * `public_id` — opaque (`03 §26`), внутренний UUID наружу не отдаём. 04 §19, 12 §5.4.
 */
export const STOREFRONT_START_PREFIX = 'shop_';

export interface StorefrontLinkParts {
  botUsername: string;
  /** Короткое имя Mini App из BotFather — обязательный сегмент прямой ссылки. */
  appShortname: string;
  publicId: string;
}

/** `startapp`-значение: `shop_<public_id>`. */
export function buildStorefrontStartParam(publicId: string): string {
  return `${STOREFRONT_START_PREFIX}${publicId}`;
}

/** Полная публичная ссылка на витрину (открывает Mini App напрямую). */
export function buildStorefrontLink({
  botUsername,
  appShortname,
  publicId,
}: StorefrontLinkParts): string {
  return `https://t.me/${botUsername}/${appShortname}?startapp=${buildStorefrontStartParam(publicId)}`;
}

/** Обратный разбор `startapp`: возвращает `public_id` или null. */
export function parseStorefrontStartParam(param: string | null | undefined): string | null {
  if (!param || !param.startsWith(STOREFRONT_START_PREFIX)) return null;
  const publicId = param.slice(STOREFRONT_START_PREFIX.length);
  return publicId || null;
}

import { requestWriteAccess, shareURL } from '@telegram-apps/sdk';
import { BUYER_APP_SHORTNAME, BUYER_BOT_USERNAME } from '../insforge/config';
import { buildStorefrontLink } from '../../domain/rules/storefront-link';

/**
 * Прямая ссылка на витрину (сразу Mini App, не чат бота):
 * `t.me/<buyer_bot>/<app>?startapp=shop_<public_id>`. Формат — в domain-правиле.
 */
export function buildBuyerLink(publicId: string): string {
  return buildStorefrontLink({
    botUsername: BUYER_BOT_USERNAME,
    appShortname: BUYER_APP_SHORTNAME,
    publicId,
  });
}

export function shareStoreLink(publicId: string): void {
  try {
    shareURL(buildBuyerLink(publicId));
  } catch {
    // Вне Telegram — игнорируем, копирование обработает UI
  }
}

/**
 * Максимальное время ожидания ответа Telegram на запрос сообщений. Системный
 * попап «Разрешить боту сообщения?» требует решения человека, поэтому дедлайн
 * длинный: обрывать его слишком рано (1200 ms) означало терять согласие почти
 * всегда. Значение — только страховка от «зависшего» promise SDK.
 */
export const MESSAGES_ACCESS_TIMEOUT_MS = 60_000;

/**
 * Официальный запрос Telegram «Разрешить боту отправлять сообщения?».
 * Вызывать по явному тапу пользователя на экране успеха (жест) — так у
 * согласия максимальный шанс, а «Заказ принят» досылается сразу после него.
 *
 * BEST-EFFORT: результат совещательный, вызывающая сторона не должна зависеть
 * от `true`. Метод никогда не бросает и не виснет — возвращает boolean не
 * позднее MESSAGES_ACCESS_TIMEOUT_MS (SDK-шный promise может не резолвиться,
 * если Telegram не прислал событие).
 */
export async function requestMessagesAccess(): Promise<boolean> {
  let access: Promise<boolean>;
  try {
    // Синхронный вызов сохраняет контекст пользовательского жеста.
    access = requestWriteAccess().then((status) => status === 'allowed');
  } catch {
    return false;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), MESSAGES_ACCESS_TIMEOUT_MS);
  });

  try {
    return await Promise.race([access.catch(() => false), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

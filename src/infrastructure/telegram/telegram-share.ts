import { requestWriteAccess, shareURL } from '@telegram-apps/sdk';
import { BUYER_APP_SHORTNAME, BUYER_BOT_USERNAME } from '../insforge/config';

/**
 * Прямая ссылка на витрину (сразу Mini App, не чат бота):
 * t.me/<buyer_bot>/<app>?startapp=store_<storeId>
 */
export function buildBuyerLink(storeId: string): string {
  return `https://t.me/${BUYER_BOT_USERNAME}/${BUYER_APP_SHORTNAME}?startapp=store_${storeId}`;
}

export function shareStoreLink(storeId: string): void {
  try {
    shareURL(buildBuyerLink(storeId));
  } catch {
    // Вне Telegram — игнорируем, копирование обработает UI
  }
}

/**
 * Максимальное время ожидания ответа Telegram на запрос сообщений.
 * Держим коротким: пока идёт оформление, виден переход заказа, и подвисание
 * на системном попапе недопустимо.
 */
export const MESSAGES_ACCESS_TIMEOUT_MS = 1200;

/**
 * Официальный запрос Telegram «Разрешить боту отправлять сообщения?».
 * Вызывать В МОМЕНТ клика «Заказать», до invokeCheckout — так у первого
 * уведомления «Заказ принят» больше шансов дойти. Один раз на бота.
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

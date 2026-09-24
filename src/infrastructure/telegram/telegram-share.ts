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
 * Официальный запрос Telegram «Разрешить боту отправлять сообщения?».
 * Вызывать В МОМЕНТ клика «Заказать», до invokeCheckout — иначе первое
 * уведомление «Заказ принят» не дойдёт. Один раз на бота.
 */
export async function requestMessagesAccess(): Promise<boolean> {
  try {
    return (await requestWriteAccess()) === 'allowed';
  } catch {
    return false;
  }
}

import { DEV_AUTH_MODE } from '../insforge/config';
import { getRawInitData } from '../telegram/telegram-app';
import type { ServerUser } from '../functions/auth-api';

/**
 * Провайдер идентичности. Единственное место, которое знает, откуда берётся
 * identity: production — сырой Telegram initData, dev — явный mock.
 *
 * Бизнес-логика работает с результатом AuthService и не знает, почему identity
 * появилась. Mock живёт только при DEV_AUTH_MODE и недоступен в production.
 */
export { getRawInitData };

/** Mock identity для локальной разработки вне Telegram. null в production. */
export function getDevServerUser(): ServerUser | null {
  if (!DEV_AUTH_MODE) return null;
  return {
    id: 'dev_user',
    telegramUserId: 'dev_12345',
    username: 'dev_user',
    firstName: 'Dev User',
    languageCode: 'ru',
  };
}

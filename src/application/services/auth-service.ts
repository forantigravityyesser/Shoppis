import type { EntryBot, ServerUser } from '../contracts/auth';
import { deps } from '../composition/container';

/**
 * Runtime-сессия. Живёт только в памяти (Zustand): при каждом запуске Mini App
 * initData свежий, поэтому restore/persist не нужны — повторная аутентификация
 * при открытии является источником истины.
 */
export interface RuntimeSession {
  /** Подписанная сервером сессия. null только в dev mock. */
  token: string | null;
  /**
   * Платформенный access-JWT (RLS-мост, docs/11 §S1). null — dev mock / сбой
   * подписи: клиент остаётся в роли `anon`.
   */
  accessToken: string | null;
  user: ServerUser;
  /** true — identity подтверждена сервером (HMAC); false — dev mock. */
  serverVerified: boolean;
  /** Бот, из которого открыт Mini App (для контекста входа без startapp). */
  bot: EntryBot;
}

/**
 * Единственная точка аутентификации:
 *   Telegram initData → telegram-auth (HMAC) → Shoppis User + session.
 * Вне Telegram при DEV_AUTH_MODE отдаёт явный dev identity, иначе бросает ошибку.
 */
export async function authenticate(): Promise<RuntimeSession> {
  const { authApi, identity } = deps();
  const rawInitData = identity.getRawInitData();

  if (rawInitData) {
    try {
      const { token, accessToken, user, bot } = await authApi.authenticateTelegram(rawInitData);
      return { token, accessToken, user, serverVerified: true, bot };
    } catch (e) {
      const dev = identity.getDevServerUser();
      if (!dev) throw e;
      console.warn('[auth] server auth failed, falling back to dev identity:', e);
      return { token: null, accessToken: null, user: dev, serverVerified: false, bot: null };
    }
  }

  const dev = identity.getDevServerUser();
  if (dev) return { token: null, accessToken: null, user: dev, serverVerified: false, bot: null };

  throw new Error('Telegram initData is unavailable');
}

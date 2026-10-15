import { invokeFunction } from '../insforge/functions-gateway';
import type { AuthSession, EntryBot, ServerUser } from '../../application/contracts/auth';

interface AuthResponse {
  success?: boolean;
  token?: string;
  user?: ServerUser;
  bot?: string | null;
  error?: string;
}

function toEntryBot(value: unknown): EntryBot {
  return value === 'buyer' || value === 'seller' ? value : null;
}

/**
 * Серверная валидация Telegram initData → User + сессия.
 * Вызывает edge-функцию telegram-auth. Подпись проверяется на сервере.
 */
export async function authenticateTelegram(initData: string): Promise<AuthSession> {
  const { data, error } = await invokeFunction<AuthResponse>('telegram-auth', {
    body: { initData },
  });
  if (error) throw new Error(error.message);
  if (!data?.success || !data.token || !data.user) {
    throw new Error(data?.error ?? 'Telegram authentication failed');
  }
  return { token: data.token, user: data.user, bot: toEntryBot(data.bot) };
}

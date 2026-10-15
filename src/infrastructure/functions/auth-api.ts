import { invokeFunction } from '../insforge/functions-gateway';
import { insforge } from '../insforge/client';
import type { AuthSession, EntryBot, ServerUser } from '../../application/contracts/auth';

interface AuthResponse {
  success?: boolean;
  token?: string;
  accessToken?: string | null;
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
  return { token: data.token, accessToken: data.accessToken ?? null, user: data.user, bot: toEntryBot(data.bot) };
}

/**
 * Применить/сбросить платформенный access-JWT на SDK-клиенте: после этого
 * database/storage/realtime-запросы идут как `authenticated` с `auth.uid()`
 * (RLS-мост, docs/11 §S1). `null` — вернуться к `anon`.
 */
export function setAccessToken(token: string | null): void {
  insforge.setAccessToken(token);
}

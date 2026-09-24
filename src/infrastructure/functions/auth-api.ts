import { insforge } from '../insforge/client';

export interface ServerUser {
  id: string;
  telegramUserId: string;
  username: string;
  firstName: string;
  languageCode: string;
}

export interface AuthSession {
  token: string;
  user: ServerUser;
}

type InvokeOptions = { body?: unknown; headers?: Record<string, string> };

/**
 * Серверная валидация Telegram initData → User + сессия.
 * Вызывает edge-функцию telegram-auth. Подпись проверяется на сервере.
 */
export async function authenticateTelegram(initData: string): Promise<AuthSession> {
  const { data, error } = await (insforge.functions.invoke as unknown as (
    name: string,
    options?: InvokeOptions,
  ) => Promise<{ data: unknown; error: unknown }>)('telegram-auth', {
    body: { initData },
  });
  if (error) throw error;
  const res = data as { success?: boolean; token?: string; user?: ServerUser; error?: string } | null;
  if (!res?.success || !res.token || !res.user) {
    throw new Error(res?.error ?? 'Telegram authentication failed');
  }
  return { token: res.token, user: res.user };
}

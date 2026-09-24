import { invokeFunction } from '../insforge/functions-gateway';

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

interface AuthResponse {
  success?: boolean;
  token?: string;
  user?: ServerUser;
  error?: string;
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
  return { token: data.token, user: data.user };
}

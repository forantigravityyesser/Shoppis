/** Серверный пользователь — authoritative identity после валидации initData. */
export interface ServerUser {
  id: string;
  telegramUserId: string;
  username: string;
  firstName: string;
  languageCode: string;
  /** Telegram `photo_url`; пусто, если Telegram не отдал фото (fallback — первая буква). */
  photoUrl: string;
  /**
   * Согласие на Telegram-уведомления из БД (`telegram_identities.notifications_enabled`).
   * Source of truth — сервер: клиент не персистит это значение, а берёт из сессии,
   * поэтому сброс флага в БД корректно возвращает запрос разрешения.
   */
  notificationsEnabled: boolean;
}

/** Бот, из которого открыт Mini App (источник входа). null — определить не удалось. */
export type EntryBot = 'buyer' | 'seller' | null;

/** Серверная runtime-сессия. */
export interface AuthSession {
  token: string;
  /**
   * Платформенный access-JWT (RS256, `sub = users.id`) для PostgREST/Storage/
   * Realtime: даёт роль `authenticated` и `auth.uid()` под RLS (docs/11 §S1).
   * `null` — токен не выпущен (dev mock / сбой подписи): клиент ходит как `anon`.
   */
  accessToken: string | null;
  user: ServerUser;
  /**
   * Источник входа (подпись initData совпала с токеном этого бота). Используется,
   * когда Telegram открыл приложение без startapp: главный Mini App / «Open App».
   */
  bot: EntryBot;
}

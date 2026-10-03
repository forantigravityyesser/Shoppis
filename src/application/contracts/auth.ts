/** Серверный пользователь — authoritative identity после валидации initData. */
export interface ServerUser {
  id: string;
  telegramUserId: string;
  username: string;
  firstName: string;
  languageCode: string;
  /** Telegram `photo_url`; пусто, если Telegram не отдал фото (fallback — первая буква). */
  photoUrl: string;
}

/** Серверная runtime-сессия. */
export interface AuthSession {
  token: string;
  user: ServerUser;
}

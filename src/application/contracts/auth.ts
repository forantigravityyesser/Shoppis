/** Серверный пользователь — authoritative identity после валидации initData. */
export interface ServerUser {
  id: string;
  telegramUserId: string;
  username: string;
  firstName: string;
  languageCode: string;
}

/** Серверная runtime-сессия. */
export interface AuthSession {
  token: string;
  user: ServerUser;
}

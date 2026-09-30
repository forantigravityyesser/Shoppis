/**
 * Контакт для связи (`support_handle`) — общий username Telegram, не обязательно
 * личная ссылка продавца (может быть менеджер или бот). Храним чистый username,
 * UI достраивает `t.me/{username}`. 12 §4.3.
 *
 * Валидация намеренно мягче платформенной (Telegram допускает от 5 символов):
 * храним корректный по форме username, не ограничивая контакт лишними правилами.
 */
const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

export interface NormalizedContact {
  valid: boolean;
  /** Чистый username (без `@`, `t.me/`, схемы) при `valid: true`, иначе пусто. */
  username: string;
}

const INVALID: NormalizedContact = { valid: false, username: '' };

/** Приводит `@john`, `john`, `t.me/john`, `https://t.me/john` к `john`. */
export function normalizeTelegramUsername(input: string): NormalizedContact {
  const raw = String(input ?? '').trim();
  if (!raw) return INVALID;

  let value = raw
    .replace(/^https?:\/\//i, '')
    .replace(/^telegram\.me\//i, '')
    .replace(/^t\.me\//i, '');
  value = value.split(/[?#]/)[0] ?? '';
  value = value.replace(/^@/, '').replace(/\/+$/, '');

  if (!USERNAME_RE.test(value)) return INVALID;
  return { valid: true, username: value };
}

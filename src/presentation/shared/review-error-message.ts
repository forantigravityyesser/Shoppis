/** Человекочитаемые сообщения для кодов ошибок edge `review-actions`. */
const REVIEW_ERRORS: Record<string, string> = {
  UNAUTHORIZED: 'Войдите через Telegram, чтобы оставить отзыв.',
  ALREADY_REVIEWED: 'Вы уже оставляли отзыв по этому товару.',
  DUPLICATE_REPLY: 'Вы уже отвечали на этот отзыв.',
  CANNOT_REPLY_OWN: 'Нельзя отвечать на свой отзыв.',
  INVALID_RATING: 'Поставьте оценку от 1 до 5.',
  TEXT_REQUIRED: 'Введите текст ответа.',
  TEXT_TOO_LONG: 'Текст слишком длинный.',
  STORE_PAUSED: 'Магазин временно закрыт.',
  REVIEW_NOT_FOUND: 'Отзыв больше недоступен.',
  FORBIDDEN: 'Недостаточно прав.',
};

export function reviewErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return REVIEW_ERRORS[code] ?? 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

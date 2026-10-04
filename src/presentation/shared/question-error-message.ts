/** Человекочитаемые сообщения для кодов ошибок edge `question-actions`. */
const QUESTION_ERRORS: Record<string, string> = {
  UNAUTHORIZED: 'Войдите через Telegram, чтобы задать вопрос.',
  ALREADY_ASKED: 'Вы уже задавали вопрос по этому товару.',
  DUPLICATE_ANSWER: 'На этот вопрос уже дан ответ.',
  TEXT_REQUIRED: 'Введите текст.',
  TEXT_TOO_LONG: 'Текст слишком длинный.',
  STORE_PAUSED: 'Магазин временно закрыт.',
  QUESTION_NOT_FOUND: 'Вопрос больше недоступен.',
  PRODUCT_NOT_FOUND: 'Товар больше недоступен.',
  FORBIDDEN: 'Недостаточно прав.',
};

export function questionErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return QUESTION_ERRORS[code] ?? 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

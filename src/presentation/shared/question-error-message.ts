import i18n from 'i18next';

/** i18n-ключи для кодов ошибок edge `question-actions`. */
const QUESTION_ERROR_KEYS = {
  UNAUTHORIZED: 'errors.question.UNAUTHORIZED',
  ALREADY_ASKED: 'errors.question.ALREADY_ASKED',
  DUPLICATE_ANSWER: 'errors.question.DUPLICATE_ANSWER',
  TEXT_REQUIRED: 'errors.question.TEXT_REQUIRED',
  TEXT_TOO_LONG: 'errors.question.TEXT_TOO_LONG',
  STORE_PAUSED: 'errors.question.STORE_PAUSED',
  QUESTION_NOT_FOUND: 'errors.question.QUESTION_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'errors.question.PRODUCT_NOT_FOUND',
  FORBIDDEN: 'errors.question.FORBIDDEN',
  fallback: 'errors.question.fallback',
} as const;

type QuestionErrorKey = (typeof QUESTION_ERROR_KEYS)[keyof typeof QUESTION_ERROR_KEYS];

function questionErrorKey(code: string): QuestionErrorKey {
  if (code in QUESTION_ERROR_KEYS) {
    return QUESTION_ERROR_KEYS[code as keyof typeof QUESTION_ERROR_KEYS];
  }
  return QUESTION_ERROR_KEYS.fallback;
}

export function questionErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return i18n.t(questionErrorKey(code));
}

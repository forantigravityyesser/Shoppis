import i18n from 'i18next';

/** i18n-ключи для кодов ошибок edge `review-actions`. */
const REVIEW_ERROR_KEYS = {
  UNAUTHORIZED: 'errors.review.UNAUTHORIZED',
  ALREADY_REVIEWED: 'errors.review.ALREADY_REVIEWED',
  DUPLICATE_REPLY: 'errors.review.DUPLICATE_REPLY',
  CANNOT_REPLY_OWN: 'errors.review.CANNOT_REPLY_OWN',
  INVALID_RATING: 'errors.review.INVALID_RATING',
  TEXT_REQUIRED: 'errors.review.TEXT_REQUIRED',
  TEXT_TOO_LONG: 'errors.review.TEXT_TOO_LONG',
  STORE_PAUSED: 'errors.review.STORE_PAUSED',
  REVIEW_NOT_FOUND: 'errors.review.REVIEW_NOT_FOUND',
  FORBIDDEN: 'errors.review.FORBIDDEN',
  fallback: 'errors.review.fallback',
} as const;

type ReviewErrorKey = (typeof REVIEW_ERROR_KEYS)[keyof typeof REVIEW_ERROR_KEYS];

function reviewErrorKey(code: string): ReviewErrorKey {
  if (code in REVIEW_ERROR_KEYS) {
    return REVIEW_ERROR_KEYS[code as keyof typeof REVIEW_ERROR_KEYS];
  }
  return REVIEW_ERROR_KEYS.fallback;
}

export function reviewErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return i18n.t(reviewErrorKey(code));
}

/** Коды ошибок смены статуса товара (архив/витрина). Контракт application → UI. */
export type ProductStatusErrorCode = 'NO_ACTIVE_VARIANT' | 'NOT_FOUND' | 'UNKNOWN';

/** Результат смены статуса: явный ok/error-стейт для UI. */
export type ProductStatusResult =
  { ok: true } | { ok: false; code: ProductStatusErrorCode; message: string };

/** Ошибка смены статуса товара, несущая машинный код для UI. */
export class ProductStatusError extends Error {
  constructor(
    public readonly code: ProductStatusErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProductStatusError';
  }
}

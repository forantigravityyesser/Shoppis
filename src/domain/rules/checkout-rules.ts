import type { RecipientInfo } from '../models/customer';

/**
 * Правила получателя заказа (docs/18 §24–§25). Поле получателя — **адрес доставки**
 * (куда отправить товар), не email. Правила чистые: их использует и форма (disabled
 * кнопки, подсветка полей), и application (`useCheckout`), а финальную проверку
 * всё равно делает сервер (`create_order_atomic`).
 *
 * Телефон — свободный ввод, но с цифровой клавиатуры: `sanitizePhoneInput` оставляет
 * цифры и ведущий `+`; форма накладывает его на каждый ввод.
 */

/** Минимум цифр в телефоне (мягко: страна/код/номер). */
export const MIN_PHONE_DIGITS = 6;
/** Максимум цифр (E.164 — до 15). */
export const MAX_PHONE_DIGITS = 15;
/** Минимум символов в имени (ФИО). */
export const MIN_NAME_LENGTH = 2;
/** Минимум символов в адресе доставки. */
export const MIN_ADDRESS_LENGTH = 5;

/** Оставляет в телефоне только цифры и один ведущий `+`, ограничивая длину. */
export function sanitizePhoneInput(raw: string): string {
  const value = String(raw ?? '').trim();
  const digits = value.replace(/\D/g, '').slice(0, MAX_PHONE_DIGITS);
  return value.startsWith('+') ? `+${digits}` : digits;
}

/** Валидное ФИО: непустая строка разумной длины. */
export function isValidFullName(value: string): boolean {
  return String(value ?? '').trim().length >= MIN_NAME_LENGTH;
}

/** Количество цифр в телефоне. */
export function phoneDigitCount(value: string): number {
  return String(value ?? '').replace(/\D/g, '').length;
}

/** Валидный телефон: цифр от MIN до MAX. */
export function isValidPhone(value: string): boolean {
  const count = phoneDigitCount(value);
  return count >= MIN_PHONE_DIGITS && count <= MAX_PHONE_DIGITS;
}

/** Валидный адрес доставки: непустая строка разумной длины. */
export function isValidAddress(value: string): boolean {
  return String(value ?? '').trim().length >= MIN_ADDRESS_LENGTH;
}

export interface CheckoutRecipientValidation {
  nameValid: boolean;
  phoneValid: boolean;
  addressValid: boolean;
  /** Все поля валидны — кнопка «Оформить заказ» активна. */
  valid: boolean;
}

/** Пофайловая валидация получателя. */
export function validateRecipient(recipient: RecipientInfo): CheckoutRecipientValidation {
  const nameValid = isValidFullName(recipient.name);
  const phoneValid = isValidPhone(recipient.phone);
  const addressValid = isValidAddress(recipient.address);
  return {
    nameValid,
    phoneValid,
    addressValid,
    valid: nameValid && phoneValid && addressValid,
  };
}

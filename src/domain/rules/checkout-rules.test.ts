import { describe, expect, it } from 'vitest';
import {
  isValidAddress,
  isValidFullName,
  isValidPhone,
  phoneDigitCount,
  sanitizePhoneInput,
  validateRecipient,
  MAX_PHONE_DIGITS,
} from './checkout-rules';
import type { RecipientInfo } from '../models/customer';

const valid: RecipientInfo = { name: 'Иван Петров', phone: '+7 900 123-45-67', address: 'Москва' };

describe('checkout-rules', () => {
  it('sanitizePhoneInput: цифры и ведущий +, обрезка до 15 цифр', () => {
    expect(sanitizePhoneInput('+7 (900) 123-45-67')).toBe('+79001234567');
    expect(sanitizePhoneInput('8-900-123')).toBe('8900123');
    expect(sanitizePhoneInput(' 12ab34 ')).toBe('1234');
    expect(sanitizePhoneInput('+1'.repeat(30))).toHaveLength(MAX_PHONE_DIGITS + 1);
    // Один ведущий «+» сохраняем (набор международного номера), лишние — убираем.
    expect(sanitizePhoneInput('+++')).toBe('+');
  });

  it('isValidFullName', () => {
    expect(isValidFullName('И')).toBe(false);
    expect(isValidFullName('  Иван ')).toBe(true);
    expect(isValidFullName('   ')).toBe(false);
  });

  it('phoneDigitCount / isValidPhone по границам', () => {
    expect(phoneDigitCount('+7 900 123-45-67')).toBe(11);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('123456')).toBe(true);
    expect(isValidPhone('9'.repeat(MAX_PHONE_DIGITS + 1))).toBe(false);
  });

  it('isValidAddress', () => {
    expect(isValidAddress('дом')).toBe(false);
    expect(isValidAddress('Москва')).toBe(true);
    expect(isValidAddress('   ')).toBe(false);
  });

  it('validateRecipient агрегирует поля', () => {
    expect(validateRecipient(valid)).toEqual({
      nameValid: true,
      phoneValid: true,
      addressValid: true,
      valid: true,
    });

    const partial = validateRecipient({ ...valid, phone: '12' });
    expect(partial.phoneValid).toBe(false);
    expect(partial.valid).toBe(false);

    expect(validateRecipient({ name: '', phone: '', address: '' }).valid).toBe(false);
  });
});

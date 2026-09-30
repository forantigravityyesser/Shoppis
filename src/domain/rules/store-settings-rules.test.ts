import { describe, expect, it } from 'vitest';
import {
  STORE_CURRENCIES,
  STORE_LANGUAGES,
  STORE_STATUSES,
  isProfilePatchEmpty,
  isValidCurrency,
  isValidLanguage,
  isValidStatus,
  normalizeStoreName,
  validateStoreName,
} from './store-settings-rules';

describe('isValidCurrency', () => {
  it('accepts only domain currencies', () => {
    for (const code of STORE_CURRENCIES) expect(isValidCurrency(code)).toBe(true);
    expect(isValidCurrency('EUR')).toBe(false);
    expect(isValidCurrency('usd')).toBe(false);
    expect(isValidCurrency('')).toBe(false);
    expect(isValidCurrency(null)).toBe(false);
    expect(isValidCurrency(undefined)).toBe(false);
  });
});

describe('isValidLanguage', () => {
  it('accepts only domain languages', () => {
    for (const code of STORE_LANGUAGES) expect(isValidLanguage(code)).toBe(true);
    expect(isValidLanguage('de')).toBe(false);
    expect(isValidLanguage('RU')).toBe(false);
    expect(isValidLanguage(null)).toBe(false);
  });
});

describe('isValidStatus', () => {
  it('accepts only domain statuses', () => {
    for (const status of STORE_STATUSES) expect(isValidStatus(status)).toBe(true);
    expect(isValidStatus('ACTIVE ')).toBe(false);
    expect(isValidStatus('DISABLED')).toBe(false);
    expect(isValidStatus(null)).toBe(false);
  });
});

describe('normalizeStoreName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeStoreName('  Nike Shop  ')).toBe('Nike Shop');
    expect(normalizeStoreName('')).toBe('');
  });
});

describe('validateStoreName', () => {
  it('rejects empty or whitespace-only names', () => {
    expect(validateStoreName('')).not.toBeNull();
    expect(validateStoreName('   ')).not.toBeNull();
  });

  it('accepts a non-empty name', () => {
    expect(validateStoreName('Nike Shop')).toBeNull();
    expect(validateStoreName('  Nike  ')).toBeNull();
  });
});

describe('isProfilePatchEmpty', () => {
  it('treats an empty or all-undefined patch as empty', () => {
    expect(isProfilePatchEmpty({})).toBe(true);
    expect(isProfilePatchEmpty({ name: undefined, bannerUrl: undefined })).toBe(true);
  });

  it('treats any defined field as non-empty', () => {
    expect(isProfilePatchEmpty({ name: 'Nike' })).toBe(false);
    expect(isProfilePatchEmpty({ bannerUrl: '' })).toBe(false);
    expect(isProfilePatchEmpty({ currency: 'USD' })).toBe(false);
    expect(isProfilePatchEmpty({ language: 'ru' })).toBe(false);
    expect(isProfilePatchEmpty({ supportHandle: 'john' })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeTelegramUsername } from './store-contact-rules';

describe('normalizeTelegramUsername', () => {
  it('accepts plain, @-prefixed and t.me forms', () => {
    for (const input of ['john', '@john', 't.me/john', 'https://t.me/john', 'http://t.me/john']) {
      expect(normalizeTelegramUsername(input)).toEqual({ valid: true, username: 'john' });
    }
  });

  it('trims whitespace and normalizes case-sensitive value as-is', () => {
    expect(normalizeTelegramUsername('  @John_99  ')).toEqual({
      valid: true,
      username: 'John_99',
    });
  });

  it('drops trailing slash and query/hash', () => {
    expect(normalizeTelegramUsername('https://t.me/john/')).toEqual({
      valid: true,
      username: 'john',
    });
    expect(normalizeTelegramUsername('t.me/john?start=1')).toEqual({
      valid: true,
      username: 'john',
    });
  });

  it('rejects empty input', () => {
    expect(normalizeTelegramUsername('')).toEqual({ valid: false, username: '' });
    expect(normalizeTelegramUsername('   ')).toEqual({ valid: false, username: '' });
  });

  it('rejects a bare t.me without username', () => {
    expect(normalizeTelegramUsername('t.me/')).toEqual({ valid: false, username: '' });
    expect(normalizeTelegramUsername('https://t.me/')).toEqual({ valid: false, username: '' });
  });

  it('rejects non-Telegram hosts and malformed handles', () => {
    for (const input of [
      'https://google.com',
      'google.com',
      '@john name',
      'john doe',
      '@',
      'a.b',
      'john/doe',
      'https://t.me/john/doe',
    ]) {
      expect(normalizeTelegramUsername(input)).toEqual({ valid: false, username: '' });
    }
  });
});

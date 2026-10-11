import { describe, expect, it } from 'vitest';
import {
  hmac,
  hex,
  isValidTelegramInitData,
  signSession,
  timingSafeEqual,
  verifySession,
} from './auth.js';

const TOKEN = 'test-bot-token';

async function initDataFor(fields, token = TOKEN, hashOverride) {
  const dataCheckString = Object.entries(fields)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = await hmac('WebAppData', token);
  const hash = hashOverride ?? hex(await hmac(secretKey, dataCheckString));
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe('timingSafeEqual (docs/24 §2.7 D4)', () => {
  it('равные → true, разные → false, разная длина → false', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual(null, '')).toBe(true);
  });
});

describe('verifySession', () => {
  const secret = 'session-secret';
  const now = Math.floor(Date.now() / 1000);

  it('принимает валидную подпись', async () => {
    const token = await signSession({ uid: 'u1', exp: now + 3600 }, secret);
    await expect(verifySession(token, secret)).resolves.toMatchObject({ uid: 'u1' });
  });

  it('отвергает подделанную подпись (timing-safe сравнение)', async () => {
    const token = await signSession({ uid: 'u1', exp: now + 3600 }, secret);
    const [body, sig] = token.split('.');
    const tampered = `${body}.${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`;
    await expect(verifySession(tampered, secret)).resolves.toBeNull();
  });

  it('отвергает просроченную сессию', async () => {
    const token = await signSession({ uid: 'u1', exp: now - 10 }, secret);
    await expect(verifySession(token, secret)).resolves.toBeNull();
  });

  it('отвергает мусор', async () => {
    await expect(verifySession('', secret)).resolves.toBeNull();
    await expect(verifySession('no-dot', secret)).resolves.toBeNull();
  });
});

describe('isValidTelegramInitData (docs/24 §2.7 D4)', () => {
  const now = Date.now();
  const nowSeconds = Math.floor(now / 1000);

  it('свежий initData с валидной подписью → true', async () => {
    const initData = await initDataFor({ auth_date: nowSeconds, user: '{"id":1}' });
    await expect(isValidTelegramInitData(initData, [TOKEN], { now })).resolves.toBe(true);
  });

  it('просроченный auth_date → false', async () => {
    const initData = await initDataFor({ auth_date: nowSeconds - 25 * 3600, user: '{"id":1}' });
    await expect(isValidTelegramInitData(initData, [TOKEN], { now })).resolves.toBe(false);
  });

  it('auth_date из будущего (за окном сдвига) → false', async () => {
    const initData = await initDataFor({ auth_date: nowSeconds + 300, user: '{"id":1}' });
    await expect(isValidTelegramInitData(initData, [TOKEN], { now })).resolves.toBe(false);
  });

  it('отсутствующий auth_date → false', async () => {
    const initData = await initDataFor({ user: '{"id":1}' });
    await expect(isValidTelegramInitData(initData, [TOKEN], { now })).resolves.toBe(false);
  });

  it('подделанный hash → false', async () => {
    const initData = await initDataFor({ auth_date: nowSeconds, user: '{"id":1}' }, TOKEN, 'deadbeef');
    await expect(isValidTelegramInitData(initData, [TOKEN], { now })).resolves.toBe(false);
  });

  it('чужой токен → false', async () => {
    const initData = await initDataFor({ auth_date: nowSeconds, user: '{"id":1}' }, 'other-token');
    await expect(isValidTelegramInitData(initData, [TOKEN], { now })).resolves.toBe(false);
  });
});

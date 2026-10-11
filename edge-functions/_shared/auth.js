// auth.js — HMAC-примитивы, runtime-сессия и валидация Telegram initData.

import { env } from './env.js';

const enc = (s) => new TextEncoder().encode(s);

export function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Сравнение строк постоянным по времени способом (docs/24 §2.7 D4): без раннего
 * выхода на первом несовпадении. Длина не секрет (HMAC/hex фиксированной длины),
 * поэтому расхождение длины можно вернуть сразу.
 */
export function timingSafeEqual(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    typeof secret === 'string' ? enc(secret) : secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc(message));
  return new Uint8Array(sig);
}

/** Подписать runtime-сессию: b64url(payload).b64url(HMAC). */
export async function signSession(payload, secret) {
  const body = b64url(enc(JSON.stringify(payload)));
  const sig = b64url(await hmac(secret, body));
  return `${body}.${sig}`;
}

/** Проверить подпись и срок сессии. null — невалидна. */
export async function verifySession(token, secret) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = b64url(await hmac(secret, body));
  if (!timingSafeEqual(expected, sig)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!payload?.uid || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function botTokens() {
  return [env('BUYER_BOT_TOKEN'), env('SELLER_BOT_TOKEN'), env('BOT_TOKEN')].filter(Boolean);
}

export const AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;
export const AUTH_CLOCK_SKEW_SECONDS = 60;

/**
 * Валидация подписи Telegram Mini App initData по токенам ботов + окно свежести
 * `auth_date` (docs/24 §2.7 D4). Сравнение подписи — постоянное по времени.
 * @param {string} initData
 * @param {string[]} tokens
 * @param {{ maxAgeSeconds?: number, now?: number }} [options]
 */
export async function isValidTelegramInitData(initData, tokens, options = {}) {
  const maxAgeSeconds = Number.isFinite(options.maxAgeSeconds)
    ? options.maxAgeSeconds
    : AUTH_MAX_AGE_SECONDS;
  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  let signatureOk = false;
  for (const token of tokens) {
    const secretKey = await hmac('WebAppData', token);
    const computed = hex(await hmac(secretKey, dataCheckString));
    if (timingSafeEqual(computed, hash)) {
      signatureOk = true;
      break;
    }
  }
  if (!signatureOk) return false;

  // Окно свежести: подпись верна, но initData не должен быть просроченным/из будущего.
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return false;
  const ageSeconds = nowSeconds - authDate;
  if (ageSeconds > maxAgeSeconds) return false;
  if (ageSeconds < -AUTH_CLOCK_SKEW_SECONDS) return false;

  return true;
}

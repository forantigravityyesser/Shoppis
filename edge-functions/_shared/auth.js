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
  if (expected !== sig) return null;
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

/** Валидация подписи Telegram Mini App initData по токенам ботов. */
export async function isValidTelegramInitData(initData, tokens) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  for (const token of tokens) {
    const secretKey = await hmac('WebAppData', token);
    const computed = hex(await hmac(secretKey, dataCheckString));
    if (computed === hash) return true;
  }
  return false;
}

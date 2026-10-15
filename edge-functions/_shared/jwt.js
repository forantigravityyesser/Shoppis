// jwt.js — выпуск платформенного access-JWT (RS256) для RLS-контура (docs/11 §S1).
//
// Клиентская Telegram-сессия — собственный HMAC (`_shared/auth.js`), PostgREST её
// не видит. Чтобы RLS-политики могли опираться на `auth.uid()` (= claim `sub`),
// edge выпускает ВТОРОЙ токен — платформенный JWT, подписанный ключом InsForge.
//
// Ключ и kid приходят из reserved-секретов (`JWT_PRIVATE_KEY`, `JWT_KEY_ID`),
// которые инжектятся в edge-рантайм платформой; публичная половина опубликована
// в JWKS (`/.well-known/jwks.json`), поэтому PostgREST проверяет подпись сам.
//
// Ключ может лежать как PEM (PKCS#8), так и JWK-JSON — поддерживаем оба.

import { env } from './env.js';

const ALG = 'RSASSA-PKCS1-v1_5';
const HASH = 'SHA-256';

function bytesToB64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stringToB64url(value) {
  return bytesToB64url(new TextEncoder().encode(value));
}

function pemToBytes(pem) {
  const body = String(pem)
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importSigningKey(privateKey) {
  const value = String(privateKey ?? '').trim();
  if (!value) throw new Error('JWT_PRIVATE_KEY is empty');
  if (value.startsWith('{')) {
    return crypto.subtle.importKey(
      'jwk',
      JSON.parse(value),
      { name: ALG, hash: HASH },
      false,
      ['sign'],
    );
  }
  return crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(value),
    { name: ALG, hash: HASH },
    false,
    ['sign'],
  );
}

/** Наличие ключевых секретов в рантайме — только флаги, без значений. */
export function jwtEnvPresent() {
  return {
    jwtPrivateKey: Boolean(env('JWT_PRIVATE_KEY')),
    jwtKeyId: Boolean(env('JWT_KEY_ID')),
    jwtPublicKey: Boolean(env('JWT_PUBLIC_KEY')),
    jwtSecret: Boolean(env('JWT_SECRET')),
  };
}

/**
 * Подписать access-JWT для пользователя. `sub` = `public.users.id` — именно это
 * значение вернёт `auth.uid()` внутри RLS. `role = 'authenticated'` переключает
 * роль PostgREST на `authenticated`. Возвращает строку `header.payload.signature`.
 */
export async function mintAccessToken({
  sub,
  role = 'authenticated',
  ttlSeconds = 60 * 60 * 6,
  now = Math.floor(Date.now() / 1000),
}) {
  if (!sub) throw new Error('sub is required');
  const kid = env('JWT_KEY_ID');
  const header = { alg: 'RS256', typ: 'JWT', ...(kid ? { kid } : {}) };
  const payload = { sub: String(sub), role, iat: now, exp: now + Math.max(1, Number(ttlSeconds)) };
  const signingInput = `${stringToB64url(JSON.stringify(header))}.${stringToB64url(
    JSON.stringify(payload),
  )}`;
  const key = await importSigningKey(env('JWT_PRIVATE_KEY'));
  const signature = new Uint8Array(
    await crypto.subtle.sign(ALG, key, new TextEncoder().encode(signingInput)),
  );
  return `${signingInput}.${bytesToB64url(signature)}`;
}

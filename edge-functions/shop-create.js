// shop-create.js — создание магазина только с валидной сессией.
//
// POST body: { name, currency, language, bannerUrl? }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Магазин создаётся с owner_user_id из сессии (сервер-валидированная identity),
// status ACTIVE и уникальным opaque public_id. Клиентский telegram id не доверяется.
//
// Env: INSFORGE_BASE_URL, ANON_KEY, SESSION_SECRET.

import { createClient } from 'npm:@insforge/sdk';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const CURRENCY_SYMBOLS = { USD: '$', RUB: '₽', BYN: 'Br' };
const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);
const LANGUAGES = ['ru', 'en'];

function env(name, fallback = '') {
  try {
    const v = typeof Deno !== 'undefined' ? Deno.env.get(name) : undefined;
    return v || fallback;
  } catch {
    return fallback;
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

const enc = (s) => new TextEncoder().encode(s);

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(secret, message) {
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

async function verifySession(token, secret) {
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

function randomPublicId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function mapStore(row) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    ownerTelegramId: row.owner_telegram_id,
    name: row.name,
    description: row.description ?? '',
    logoUrl: row.logo_url ?? '',
    bannerUrl: row.banner_url ?? '',
    supportHandle: row.support_handle ?? '',
    currencyCode: row.currency ?? 'USD',
    currencySymbol: row.currency_symbol ?? '$',
    language: row.language ?? 'ru',
    status: row.status ?? 'ACTIVE',
    publicId: row.public_id ?? '',
    createdAt: row.created_at,
  };
}

export default async function (request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  if (request.method !== 'POST') return json({ success: false, error: 'Use POST' }, 405);

  const baseUrl = env('INSFORGE_BASE_URL');
  const anonKey = env('ANON_KEY');
  const sessionSecret = env('SESSION_SECRET');
  if (!baseUrl || !anonKey || !sessionSecret) {
    return json({ success: false, error: 'Backend is not configured' }, 500);
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const session = await verifySession(token, sessionSecret);
  if (!session) return json({ success: false, error: 'Unauthorized' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON payload' }, 400);
  }

  const name = String(body?.name || '').trim();
  if (!name) return json({ success: false, error: 'Store name is required' }, 400);

  const currency = CURRENCIES.includes(body?.currency) ? body.currency : 'USD';
  const language = LANGUAGES.includes(body?.language) ? body.language : 'ru';
  const bannerUrl = String(body?.bannerUrl || '');

  try {
    const client = createClient({ baseUrl, anonKey });
    const { data, error } = await client.database
      .from('stores')
      .insert([
        {
          owner_user_id: session.uid,
          owner_telegram_id: session.tg,
          name,
          description: '',
          banner_url: bannerUrl,
          currency,
          currency_symbol: CURRENCY_SYMBOLS[currency],
          language,
          status: 'ACTIVE',
          public_id: randomPublicId(),
        },
      ])
      .select();
    if (error) throw error;
    if (!data?.[0]?.id) throw new Error('stores insert returned no data');

    return json({ success: true, store: mapStore(data[0]) });
  } catch (e) {
    console.error('[shop-create] error:', e);
    return json({ success: false, error: 'Store creation failed' }, 500);
  }
}

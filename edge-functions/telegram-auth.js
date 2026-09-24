// telegram-auth.js — серверная валидация Telegram Mini App initData.
//
// POST body: { initData: string }  (raw initData, полученный в Mini App)
//
// Шаги: проверить HMAC-подпись initData по токену бота → резолвить/создать
// User + TelegramIdentity → выдать подписанную сессию (HMAC, секрет SESSION_SECRET).
//
// Env: INSFORGE_BASE_URL, ANON_KEY, SESSION_SECRET,
//      BUYER_BOT_TOKEN / SELLER_BOT_TOKEN (fallback BOT_TOKEN).

import { createClient } from 'npm:@insforge/sdk';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

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

function hex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
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

function botTokens() {
  return [env('BUYER_BOT_TOKEN'), env('SELLER_BOT_TOKEN'), env('BOT_TOKEN')].filter(Boolean);
}

async function isValidInitData(initData, tokens) {
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

async function signSession(payload, secret) {
  const body = b64url(enc(JSON.stringify(payload)));
  const sig = b64url(await hmac(secret, body));
  return `${body}.${sig}`;
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
    return json({ success: false, error: 'Auth backend is not configured' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON payload' }, 400);
  }

  const initData = String(body?.initData || '');
  if (!initData) return json({ success: false, error: 'initData is required' }, 400);

  const tokens = botTokens();
  if (!tokens.length) return json({ success: false, error: 'Bot token is not configured' }, 500);

  if (!(await isValidInitData(initData, tokens))) {
    return json({ success: false, error: 'Invalid Telegram initData' }, 401);
  }

  const params = new URLSearchParams(initData);
  let tgUser;
  try {
    tgUser = JSON.parse(params.get('user') || 'null');
  } catch {
    tgUser = null;
  }
  if (!tgUser?.id) return json({ success: false, error: 'Telegram user is missing' }, 400);

  const telegramUserId = String(tgUser.id);
  const identityPatch = {
    username: tgUser.username || null,
    first_name: tgUser.first_name || null,
    last_name: tgUser.last_name || null,
    language_code: tgUser.language_code || null,
  };

  try {
    const client = createClient({ baseUrl, anonKey });

    const { data: found, error: findError } = await client.database
      .from('telegram_identities')
      .select('user_id')
      .eq('telegram_user_id', telegramUserId)
      .limit(1);
    if (findError) throw findError;

    let userId = found?.[0]?.user_id;

    if (userId) {
      const { error } = await client.database
        .from('telegram_identities')
        .update(identityPatch)
        .eq('telegram_user_id', telegramUserId);
      if (error) throw error;
    } else {
      const { data: created, error: createError } = await client.database
        .from('users')
        .insert([{ status: 'ACTIVE' }])
        .select();
      if (createError) throw createError;
      userId = created?.[0]?.id;
      if (!userId) throw new Error('users insert returned no data');

      const { error: identityError } = await client.database
        .from('telegram_identities')
        .insert([{ user_id: userId, telegram_user_id: telegramUserId, ...identityPatch }]);
      if (identityError) throw identityError;
    }

    const now = Math.floor(Date.now() / 1000);
    const token = await signSession(
      { uid: userId, tg: telegramUserId, iat: now, exp: now + 60 * 60 * 24 * 30 },
      sessionSecret,
    );

    return json({
      success: true,
      token,
      user: {
        id: userId,
        telegramUserId,
        username: tgUser.username || '',
        firstName: tgUser.first_name || '',
        languageCode: tgUser.language_code || '',
      },
    });
  } catch (e) {
    console.error('[telegram-auth] error:', e);
    return json({ success: false, error: 'Identity resolution failed' }, 500);
  }
}

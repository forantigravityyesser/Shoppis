// telegram-auth.js — серверная валидация Telegram Mini App initData.
//
// POST body: { initData: string }  (raw initData, полученный в Mini App)
//
// Шаги: проверить HMAC-подпись initData по токену бота → резолвить/создать
// User + TelegramIdentity → выдать подписанную сессию (HMAC, секрет SESSION_SECRET).
//
// Env: INSFORGE_BASE_URL, ANON_KEY, SESSION_SECRET, SESSION_TTL_SECONDS?,
//      BUYER_BOT_TOKEN / SELLER_BOT_TOKEN (fallback BOT_TOKEN).
//
// Сессия — runtime authorization внутри одного запуска Mini App: клиент
// аутентифицируется заново при каждом открытии (свежий initData), поэтому TTL
// короткий, а не 30 дней.

import { createClient } from 'npm:@insforge/sdk';
import { env } from './_shared/env.js';
import { json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { botTokens, isValidTelegramInitData, signSession } from './_shared/auth.js';

export default async function (request) {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return methodNotAllowed();

  const baseUrl = env('INSFORGE_BASE_URL');
  const anonKey = env('ANON_KEY');
  const sessionSecret = env('SESSION_SECRET');
  if (!baseUrl || !anonKey || !sessionSecret) {
    return json({ success: false, error: 'Auth backend is not configured' }, 500);
  }

  const body = await readJson(request);
  if (!body) return json({ success: false, error: 'Invalid JSON payload' }, 400);

  const initData = String(body?.initData || '');
  if (!initData) return json({ success: false, error: 'initData is required' }, 400);

  const tokens = botTokens();
  if (!tokens.length) return json({ success: false, error: 'Bot token is not configured' }, 500);

  if (!(await isValidTelegramInitData(initData, tokens))) {
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
    const ttlSeconds = Number(env('SESSION_TTL_SECONDS')) || 60 * 60 * 6;
    const token = await signSession(
      { uid: userId, tg: telegramUserId, iat: now, exp: now + ttlSeconds },
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

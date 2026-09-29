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
import { env } from './_shared/env.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';

const CURRENCY_SYMBOLS = { USD: '$', RUB: '₽', BYN: 'Br' };
const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);
const LANGUAGES = ['ru', 'en'];

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
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return methodNotAllowed();

  const baseUrl = env('INSFORGE_BASE_URL');
  const anonKey = env('ANON_KEY');
  const sessionSecret = env('SESSION_SECRET');
  if (!baseUrl || !anonKey || !sessionSecret) {
    return json({ success: false, error: 'Backend is not configured' }, 500);
  }

  const session = await verifySession(bearerToken(request), sessionSecret);
  if (!session) return json({ success: false, error: 'Unauthorized' }, 401);

  const body = await readJson(request);
  if (!body) return json({ success: false, error: 'Invalid JSON payload' }, 400);

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

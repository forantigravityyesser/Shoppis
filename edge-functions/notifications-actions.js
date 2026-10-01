// notifications-actions.js — opt-in Telegram-уведомлений покупателя.
//
// POST body: { action: 'enable' }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Записывает notifications_enabled=true для текущего User (по session.uid).
// Запрос write-access делает клиент; сюда приходит только факт согласия.
//
// Env: INSFORGE_BASE_URL, ANON_KEY, SESSION_SECRET.

import { createClient } from 'npm:@insforge/sdk';
import { env } from './_shared/env.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';

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

  const action = String(body?.action || '');
  if (action !== 'enable') return json({ success: false, error: 'UNKNOWN_ACTION' }, 400);

  try {
    const client = createClient({ baseUrl, anonKey });
    const { error } = await client.database
      .from('telegram_identities')
      .update({
        notifications_enabled: true,
        notifications_enabled_at: new Date().toISOString(),
      })
      .eq('user_id', session.uid);
    if (error) throw error;
    return json({ success: true });
  } catch (e) {
    console.error('[notifications-actions] error:', e);
    return json({ success: false, error: 'Notification update failed' }, 500);
  }
}

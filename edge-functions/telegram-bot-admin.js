// telegram-bot-admin.js — служебное управление ботами (диагностика и настройка).
//
// Зачем: токены ботов — секреты, они не должны попадать в локальные скрипты или
// клиенты. Эта функция живёт рядом с секретами и умеет выполнять разовые
// административные операции через Bot API от имени обоих ботов.
//
// POST body: { action, apiKey?, base? }
// Guard: body.apiKey или `Authorization: Bearer <key>` должны совпасть с
// секретом API_KEY (сравнение постоянным по времени). Другого доступа нет.
//
// Actions:
//   status          — getMe + getWebhookInfo обоих ботов
//   set-webhooks    — setWebhook на `${base}/telegram-bot-buyer` и `.../seller`
//                     (secret_token из TELEGRAM_WEBHOOK_SECRET, только
//                     message + callback_query, drop_pending_updates)
//   delete-webhooks — deleteWebhook обоих
//   set-commands    — setMyCommands обоих ботов
//   set-menu-buttons— дефолтная кнопка-меню чатов (seller → панель, buyer → витрина)
//
// Env: BUYER_BOT_TOKEN, SELLER_BOT_TOKEN (fallback BOT_TOKEN), API_KEY, APP_URL?,
//      TELEGRAM_WEBHOOK_SECRET?

import { env } from './_shared/env.js';
import { json, methodNotAllowed, preflight, readJson, bearerToken } from './_shared/http.js';
import { timingSafeEqual } from './_shared/auth.js';

async function call(token, method, payload) {
  if (!token) return { ok: false, description: 'token is missing' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, description: String(e?.message || e) };
  }
}

function tokens() {
  return {
    buyer: env('BUYER_BOT_TOKEN') || env('BOT_TOKEN'),
    seller: env('SELLER_BOT_TOKEN') || env('BOT_TOKEN'),
  };
}

function authorized(request, body) {
  const expected = env('API_KEY');
  if (!expected) return false;
  const got = String(body?.apiKey || bearerToken(request) || '');
  return timingSafeEqual(expected, got);
}

const COMMANDS = {
  seller: [
    { command: 'start', description: 'Панель продавца' },
    { command: 'stats', description: 'Статистика магазина' },
    { command: 'mystores', description: 'Ссылка для покупателей' },
    { command: 'help', description: 'Справка' },
  ],
  buyer: [
    { command: 'start', description: 'Главное меню' },
    { command: 'myshops', description: 'Мои магазины' },
    { command: 'orders', description: 'Активные заказы' },
    { command: 'help', description: 'Справка' },
  ],
};

export default async function (request) {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return methodNotAllowed();

  const body = await readJson(request);
  if (!body) return json({ success: false, error: 'Invalid JSON payload' }, 400);
  if (!authorized(request, body)) return json({ success: false, error: 'Unauthorized' }, 401);

  const t = tokens();
  const action = String(body.action || '');

  if (action === 'status') {
    const result = {};
    for (const bot of ['buyer', 'seller']) {
      const me = await call(t[bot], 'getMe');
      const hook = await call(t[bot], 'getWebhookInfo');
      result[bot] = {
        tokenPresent: Boolean(t[bot]),
        me: me.ok
          ? {
              id: me.result?.id,
              username: me.result?.username,
              name: me.result?.first_name,
              hasMainWebApp: me.result?.has_main_web_app === true,
            }
          : { error: me.description },
        webhook: hook.ok
          ? {
              url: hook.result?.url ?? '',
              pendingUpdates: hook.result?.pending_update_count ?? 0,
              lastError: hook.result?.last_error_message ?? null,
              allowedUpdates: hook.result?.allowed_updates ?? null,
              hasCustomCertificate: hook.result?.has_custom_certificate ?? false,
            }
          : { error: hook.description },
      };
    }
    return json({ success: true, result });
  }

  if (action === 'set-webhooks') {
    const base = String(body.base || '').replace(/\/$/, '');
    if (!base) return json({ success: false, error: 'base is required' }, 400);
    const secret = env('TELEGRAM_WEBHOOK_SECRET');
    const result = {};
    for (const bot of ['buyer', 'seller']) {
      const url = `${base}/telegram-bot-${bot}`;
      const res = await call(t[bot], 'setWebhook', {
        url,
        ...(secret ? { secret_token: secret } : {}),
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      });
      result[bot] = { url, ok: res.ok === true, error: res.ok ? null : res.description };
    }
    return json({ success: true, result });
  }

  if (action === 'delete-webhooks') {
    const result = {};
    for (const bot of ['buyer', 'seller']) {
      const res = await call(t[bot], 'deleteWebhook', { drop_pending_updates: false });
      result[bot] = { ok: res.ok === true, error: res.ok ? null : res.description };
    }
    return json({ success: true, result });
  }

  if (action === 'set-commands') {
    const result = {};
    for (const bot of ['buyer', 'seller']) {
      const res = await call(t[bot], 'setMyCommands', { commands: COMMANDS[bot] });
      result[bot] = { ok: res.ok === true, error: res.ok ? null : res.description };
    }
    return json({ success: true, result });
  }

  if (action === 'set-menu-buttons') {
    const appUrl = env('APP_URL').replace(/\/$/, '');
    if (!appUrl) return json({ success: false, error: 'APP_URL is not configured' }, 500);
    const buttons = {
      seller: {
        type: 'web_app',
        text: '🏪 Панель продавца',
        web_app: { url: `${appUrl}?startapp=seller` },
      },
      buyer: { type: 'web_app', text: '🛍️ Открыть витрину', web_app: { url: appUrl } },
    };
    const result = {};
    for (const bot of ['buyer', 'seller']) {
      const res = await call(t[bot], 'setChatMenuButton', { menu_button: buttons[bot] });
      result[bot] = { ok: res.ok === true, error: res.ok ? null : res.description };
    }
    return json({ success: true, result });
  }

  return json({ success: false, error: 'UNKNOWN_ACTION' }, 400);
}

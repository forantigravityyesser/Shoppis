// telegram-bot-buyer.js — webhook edge-функция БОТА ПОКУПАТЕЛЯ.
//
// Роль: единственный бот для ВСЕХ покупателей и ВСЕХ магазинов.
// Отдельный бот под каждый магазин НЕ создаётся: магазин различается
// параметром startapp=store_<storeId>, а «Мои магазины» выводятся из таблицы
// customers (уникальность store_id + telegram_id, см. docs/DATABASE.md):
// каждая строка = привязка покупателя к одной витрине.
//
// ВАЖНО (витрина-first): покупатель СНАЧАЛА попадает в витрину НАПРЯМУЮ
// по ссылке продавца:
//   https://t.me/<BUYER_BOT_USERNAME>/<BUYER_APP_SHORTNAME>?startapp=store_<storeId>
// Тап открывает сразу Mini App, чата с этим ботом у человека ещё нет.
// В бот (чат) он попадает ПОСЛЕ заказа: фронт в момент клика «Заказать»
// вызывает официальный requestWriteAccess(), покупатель разрешает сообщения,
// и process-checkout шлёт сюда «Заказ принят». Сюда же приходят смена
// статуса и акции. Прямой /start без параметра показывает список уже
// посещённых витрин (бот работает и без БД в graceful-режиме).
//
// Env:
//   BUYER_BOT_TOKEN (fallback: BOT_TOKEN) — токен бота покупателя
//   APP_URL — базовый URL Mini App
//   INSFORGE_BASE_URL, ANON_KEY — customers/stores (опционально, graceful)

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function env(name, fallback = '') {
  try {
    const v = typeof Deno !== 'undefined' ? Deno.env.get(name) : undefined;
    return v || fallback;
  } catch {
    return fallback;
  }
}

function cfg() {
  return {
    token: env('BUYER_BOT_TOKEN') || env('BOT_TOKEN'),
    appUrl: (env('APP_URL') || 'https://your-app.region.insforge.app').replace(/\/$/, ''),
    baseUrl: env('INSFORGE_BASE_URL'),
    anonKey: env('ANON_KEY'),
  };
}

async function tg(token, method, payload) {
  if (!token) {
    console.error(`[buyer-bot] missing token, skip ${method}`);
    return null;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error(`[buyer-bot] ${method} failed:`, await res.text());
    return res;
  } catch (e) {
    console.error(`[buyer-bot] ${method} error:`, e);
    return null;
  }
}

const sendMessage = (token, chat_id, text, reply_markup) =>
  tg(token, 'sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) });

const editMessage = (token, chat_id, message_id, text, reply_markup) =>
  tg(token, 'editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) });

const answerCallback = (token, id) =>
  tg(token, 'answerCallbackQuery', { callback_query_id: id });

// Mini App конкретной витрины: корзина/заказы/избранное изолированы по storeId на фронте.
function storeAppUrl(appUrl, storeId) {
  return `${appUrl}?startapp=store_${storeId}`;
}

// --- InsForge (опционально). Все вызовы tolerant: бот работает и без БД. ---
function dbHeaders(anonKey) {
  return { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' };
}

async function findStore(baseUrl, anonKey, storeId) {
  try {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, '')}/api/database/stores?id=eq.${encodeURIComponent(storeId)}&select=id,name`,
      { headers: dbHeaders(anonKey) }
    );
    if (!res.ok) return null;
    const j = await res.json();
    const rows = Array.isArray(j) ? j : (j?.data ?? []);
    return rows[0] || null;
  } catch (e) {
    console.error('[buyer-bot] findStore error:', e);
    return null;
  }
}

// Привязка покупателя к витрине: upsert customers(store_id, telegram_id).
// Таблица уже имеет UNIQUE(store_id, telegram_id) — это и есть «список магазинов».
// on_conflict обязателен для PostgREST merge-duplicates, иначе будет дубль-ошибка.
async function bindBuyerToStore(baseUrl, anonKey, storeId, tgUser) {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/database/customers?on_conflict=store_id,telegram_id`, {
      method: 'POST',
      headers: { ...dbHeaders(anonKey), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        store_id: storeId,
        telegram_id: String(tgUser.id),
        username: tgUser.username || 'User',
      }),
    });
    if (!res.ok) console.error('[buyer-bot] bind buyer failed:', await res.text());
  } catch (e) {
    console.error('[buyer-bot] bind buyer error:', e);
  }
}

// Витрины покупателя: все customers.telegram_id = X → подтягиваем stores.
async function getBuyerStores(baseUrl, anonKey, telegramId) {
  try {
    const r1 = await fetch(
      `${baseUrl.replace(/\/$/, '')}/api/database/customers?telegram_id=eq.${encodeURIComponent(String(telegramId))}&select=store_id`,
      { headers: dbHeaders(anonKey) }
    );
    if (!r1.ok) return null;
    const j1 = await r1.json();
    const rows = Array.isArray(j1) ? j1 : (j1?.data ?? []);
    const ids = [...new Set(rows.map((r) => r.store_id).filter(Boolean))].slice(0, 20);
    if (!ids.length) return [];
    const r2 = await fetch(
      `${baseUrl.replace(/\/$/, '')}/api/database/stores?id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,name`,
      { headers: dbHeaders(anonKey) }
    );
    if (!r2.ok) return ids.map((id) => ({ id }));
    const j2 = await r2.json();
    return Array.isArray(j2) ? j2 : (j2?.data ?? ids.map((id) => ({ id })));
  } catch (e) {
    console.error('[buyer-bot] getBuyerStores error:', e);
    return null;
  }
}

// /start store_<id> | /start store-<id> | /start <uuid> — все варианты deep-link'а.
function parseStartParam(text) {
  const m = String(text || '').trim().match(/^\/start(@\S+)?\s*(.*)$/);
  if (!m) return '';
  return (m[2] || '').trim();
}

function extractStoreId(param) {
  if (!param) return '';
  const p = param.replace(/^store[_-]/i, '').trim();
  // UUID витрины либо уже голый id
  const uuid = p.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return (uuid ? uuid[0] : p.split(/\s+/)[0]).trim();
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    try {
      const update = await request.json();
      this.handleUpdate(update).catch((e) => console.error('[buyer-bot] handle error:', e));
      return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
    } catch (e) {
      console.error('[buyer-bot] parse error:', e);
      return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
    }
  },

  async handleUpdate(update) {
    const c = cfg();
    if (update.callback_query) return this.onCallback(c, update.callback_query);
    const msg = update.message || update.edited_message;
    if (!msg?.chat?.id) return;
    const text = (msg.text || '').trim();
    const chatId = msg.chat.id;
    const tgUser = msg.from || {};

    if (/^\/start(@\w+)?(\s|$)/.test(text)) {
      const storeId = extractStoreId(parseStartParam(text));
      if (storeId) return this.onStoreEntry(c, chatId, tgUser, storeId);
      return this.onMain(c, chatId, tgUser);
    }
    if (/^\/myshops(@\w+)?|^\/mystores(@\w+)?/.test(text)) return this.onMyShops(c, chatId, tgUser, false);
    if (/^\/help(@\w+)?/.test(text)) {
      return sendMessage(c.token, chatId,
        '🛍 <b>Бот покупателя</b>\n\n' +
        'В магазин можно попасть только по ссылке-приглашению от продавца.\n\n' +
        '/myshops — витрины, где вы уже были (корзина, заказы и избранное — отдельно в каждой)\n' +
        '/start — это же меню\n\n' +
        'Уведомления о заказе и смене статуса приходят сюда автоматически. ' +
        'Если их нет — откройте любую витрину и разрешите сообщения, когда Mini App спросит.');
    }
    if (text.startsWith('/')) return this.onMain(c, chatId, tgUser);
    // Обычный текст без ссылки — подсказываем, где взять приглашение.
    return sendMessage(c.token, chatId,
      '🔗 Чтобы попасть в магазин, нужна ссылка-приглашение от продавца.\n' +
      'Если вы уже переходили по ссылкам — откройте /myshops.');
  },

  // Вход по ссылке продавца: привязываем и даём кнопку web_app именно в эту витрину.
  async onStoreEntry(c, chatId, tgUser, storeId) {
    const hasDb = c.baseUrl && c.anonKey;
    let storeName = '';
    if (hasDb) {
      const store = await findStore(c.baseUrl, c.anonKey, storeId);
      if (!store) {
        return sendMessage(c.token, chatId,
          '😕 <b>Витрина не найдена</b>\n\nВозможно, продавец удалил магазин или ссылка устарела. Попросите новую ссылку.');
      }
      storeName = store.name ? ` «${escapeHtml(store.name)}»` : '';
      if (tgUser?.id) await bindBuyerToStore(c.baseUrl, c.anonKey, storeId, tgUser);
    }
    return sendMessage(c.token, chatId,
      `✅ <b>Добро пожаловать${storeName}!</b>\n\n` +
      'Вы зашли по ссылке продавца: витрина уже открыта в Mini App.\n' +
      'Корзина, заказы и избранное здесь — только этого магазина.\n' +
      'Чат с этим ботом появится после заказа: в момент клика «Заказать» Mini App официально спросит разрешение на сообщения — нажмите «Разрешить», и сюда придёт «Заказ принят», а затем статусы и акции.',
      {
        inline_keyboard: [
          [{ text: '🛍️ Открыть витрину', web_app: { url: storeAppUrl(c.appUrl, storeId) } }],
          [{ text: '📋 Мои магазины', callback_data: 'buyer_myshops' }],
        ],
      });
  },

  async onMain(c, chatId, tgUser) {
    // /start без параметра: если есть привязки — сразу список, иначе онбординг.
    if (c.baseUrl && c.anonKey && tgUser?.id) {
      const stores = await getBuyerStores(c.baseUrl, c.anonKey, tgUser.id);
      if (stores?.length) return this.sendShopList(c, chatId, stores);
    }
    return sendMessage(c.token, chatId,
      '🛍 <b>Бот покупателя</b>\n\n' +
      'Здесь живут все ваши магазины: заказы, статусы доставки и акции продавцов.\n\n' +
      'Как начать:\n' +
      '1️⃣ Получите у продавца ссылку-приглашение\n' +
      '2️⃣ Перейдите по ней — витрина откроется сразу\n' +
      '3️⃣ Она сохранится в /myshops, и сюда будут приходить уведомления',
      {
        inline_keyboard: [
          [{ text: '📋 Мои магазины', callback_data: 'buyer_myshops' }],
          [{ text: 'ℹ️ Как это работает', callback_data: 'buyer_how' }],
        ],
      });
  },

  async onMyShops(c, chatId, tgUser, edit, messageId) {
    const hasDb = c.baseUrl && c.anonKey;
    if (!hasDb || !tgUser?.id) {
      const text = '📋 <b>Мои магазины</b>\n\nПерейдите в магазин по ссылке-приглашению от продавца — он появится здесь.';
      const kb = { inline_keyboard: [[{ text: 'ℹ️ Как это работает', callback_data: 'buyer_how' }]] };
      return edit ? editMessage(c.token, chatId, messageId, text, kb) : sendMessage(c.token, chatId, text, kb);
    }
    const stores = await getBuyerStores(c.baseUrl, c.anonKey, tgUser.id);
    if (!stores?.length) {
      const text = '📋 <b>Мои магазины</b>\n\nПока пусто. Попросите у продавца ссылку-приглашение и перейдите по ней — магазин сохранится здесь.';
      const kb = { inline_keyboard: [[{ text: 'ℹ️ Как это работает', callback_data: 'buyer_how' }]] };
      return edit ? editMessage(c.token, chatId, messageId, text, kb) : sendMessage(c.token, chatId, text, kb);
    }
    if (edit) {
      // editMessageText не может заменить сообщение на новое с web_app-кнопками для разных витрин
      // надёжнее отправить свежим сообщением — Telegram сам покажет кнопки открытия.
      await tg(c.token, 'deleteMessage', { chat_id: chatId, message_id: messageId }).catch(() => {});
    }
    return this.sendShopList(c, chatId, stores);
  },

  // Каждой витрине — своя кнопка web_app с её storeId (изоляция контекста на фронте).
  async sendShopList(c, chatId, stores) {
    const rows = stores.slice(0, 15).map((s) => ([
      { text: `🛍️ ${s.name || 'Магазин'}`, web_app: { url: storeAppUrl(c.appUrl, s.id) } },
    ]));
    rows.push([{ text: 'ℹ️ Как это работает', callback_data: 'buyer_how' }]);
    return sendMessage(c.token, chatId,
      '📋 <b>Мои магазины</b>\n\nВыберите витрину. Корзина, заказы и избранное — свои в каждой.',
      { inline_keyboard: rows });
  },

  async onCallback(c, q) {
    const chatId = q.message?.chat?.id;
    const messageId = q.message?.message_id;
    const data = q.data || '';
    await answerCallback(c.token, q.id);
    if (!chatId) return;
    const tgUser = q.from || {};

    if (data === 'buyer_myshops') return this.onMyShops(c, chatId, tgUser, true, messageId);
    if (data === 'buyer_main') {
      return editMessage(c.token, chatId, messageId,
        '🛍 <b>Бот покупателя</b>\n\nВыберите действие:',
        { inline_keyboard: [[{ text: '📋 Мои магазины', callback_data: 'buyer_myshops' }], [{ text: 'ℹ️ Как это работает', callback_data: 'buyer_how' }]] });
    }
    if (data === 'buyer_how') {
      return editMessage(c.token, chatId, messageId,
        'ℹ️ <b>Как это работает</b>\n\n' +
        '1. Продавец создаёт витрину в <b>боте продавца</b> и присылает вам ссылку\n' +
        '2. Вы переходите — попадаете в витрину (Mini App с <code>?startapp=store_...</code>)\n' +
        '3. Корзина, заказы и избранное — отдельные в каждом магазине\n' +
        '4. При оформлении Mini App спросит разрешение на сообщения — разрешите, и статусы/акции будут приходить сюда\n\n' +
        'Без ссылки продавца попасть в чужую витрину нельзя.',
        { inline_keyboard: [[{ text: '📋 Мои магазины', callback_data: 'buyer_myshops' }], [{ text: '⬅️ Назад', callback_data: 'buyer_main' }]] });
    }
  },
};

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

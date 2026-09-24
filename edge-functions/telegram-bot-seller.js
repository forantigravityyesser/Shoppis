// telegram-bot-seller.js — webhook edge-функция БОТА ПРОДАВЦА.
//
// Роль: только продавец. Здесь открывается Mini App в режиме админ-панели
// (витрина, товары, заказы, настройки) и генерируется ссылка-приглашение
// в магазин. Покупательской логики тут нет.
//
// ВАЖНО (витрина-first): ссылка-приглашение ведёт НЕ в чат бота покупателя,
// а СРАЗУ в Mini App (витрину):
//   https://t.me/<BUYER_BOT_USERNAME>/<BUYER_APP_SHORTNAME>?startapp=store_<storeId>
// Тап по ней открывает витрину напрямую. Чат с ботом покупателя у человека
// появляется позже — после заказа + официального requestWriteAccess,
// когда process-checkout шлёт первое уведомление «Заказ принят».
// Отдельный бот под каждый магазин НЕ создаётся.
//
// Env:
//   SELLER_BOT_TOKEN (fallback: BOT_TOKEN) — токен бота продавца
//   APP_URL — базовый URL Mini App (https://... без query)
//   INSFORGE_BASE_URL, ANON_KEY — для проверки stores (опционально, graceful)
//   BUYER_BOT_USERNAME, BUYER_APP_SHORTNAME — для генерации ссылки покупателю
//
// Webhook: POST от Telegram → всегда 200 {"ok":true}, сообщения шлём через Bot API.

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
    token: env('SELLER_BOT_TOKEN') || env('BOT_TOKEN'),
    appUrl: (env('APP_URL') || 'https://your-app.region.insforge.app').replace(/\/$/, ''),
    baseUrl: env('INSFORGE_BASE_URL'),
    anonKey: env('ANON_KEY'),
    buyerUsername: env('BUYER_BOT_USERNAME') || 'buyer_bot_name',
    buyerApp: env('BUYER_APP_SHORTNAME') || 'app',
  };
}

async function tg(token, method, payload) {
  if (!token) {
    console.error(`[seller-bot] missing token, skip ${method}`);
    return null;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error(`[seller-bot] ${method} failed:`, await res.text());
    return res;
  } catch (e) {
    console.error(`[seller-bot] ${method} error:`, e);
    return null;
  }
}

const sendMessage = (token, chat_id, text, reply_markup) =>
  tg(token, 'sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) });

const editMessage = (token, chat_id, message_id, text, reply_markup) =>
  tg(token, 'editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) });

const answerCallback = (token, id, text) =>
  tg(token, 'answerCallbackQuery', { callback_query_id: id, ...(text ? { text: text.slice(0, 190) } : {}) });

// --- InsForge (опционально): проверка витрин владельца, без жёсткой зависимости ---
function dbHeaders(anonKey) {
  return { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' };
}

async function getStoresByOwner(baseUrl, anonKey, ownerTelegramId) {
  if (!baseUrl || !anonKey) return null; // БД не настроена — покажем меню без списка
  try {
    const url = `${baseUrl.replace(/\/$/, '')}/api/database/stores?owner_telegram_id=eq.${encodeURIComponent(String(ownerTelegramId))}&select=id,name`;
    const res = await fetch(url, { headers: dbHeaders(anonKey) });
    if (!res.ok) {
      console.error('[seller-bot] stores lookup failed:', await res.text());
      return null;
    }
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.data ?? null);
  } catch (e) {
    console.error('[seller-bot] stores lookup error:', e);
    return null;
  }
}

// Ссылка-приглашение: открывает СРАЗУ Mini App (витрину), а не чат бота.
// Технически это t.me-линк единого бота покупателя, но с shortname приложения
// и startapp — Telegram открывает по нему витрину напрямую.
function buyerDeepLink(buyerUsername, buyerApp, storeId) {
  return `https://t.me/${buyerUsername}/${buyerApp}?startapp=store_${storeId}`;
}

function sellerAppUrl(appUrl) {
  // Админ-панель продавца: Mini App открывается с startapp=seller (см. docs/ARCHITECTURE.md)
  return `${appUrl}?startapp=seller`;
}

function mainMenu(appUrl) {
  return {
    inline_keyboard: [
      [{ text: '🏪 Открыть панель продавца', web_app: { url: sellerAppUrl(appUrl) } }],
      [{ text: '📊 Мои магазины', callback_data: 'seller_my_stores' }],
      [{ text: 'ℹ️ Как пригласить покупателя', callback_data: 'seller_how_invite' }],
    ],
  };
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
      // Webhook должен отвечать быстро — обрабатываем и возвращаем ok.
      // fire-and-forget: не блокируем ответ Telegram.
      this.handleUpdate(update).catch((e) => console.error('[seller-bot] handle error:', e));
      return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
    } catch (e) {
      console.error('[seller-bot] parse error:', e);
      return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
    }
  },

  async handleUpdate(update) {
    const c = cfg();
    if (update.callback_query) return this.onCallback(c, update.callback_query);
    const msg = update.message || update.edited_message;
    if (!msg) return;
    // Покупательские deep-link'и сюда попадать не должны, но если попали — вежливо редиректим.
    const text = (msg.text || '').trim();
    const fromId = msg.from?.id;
    const chatId = msg.chat?.id;
    if (!chatId) return;

    if (/^\/start(@\w+)?(\s|$)/.test(text)) return this.onStart(c, chatId, fromId);
    if (/^\/mystores(@\w+)?/.test(text)) return this.onMyStores(c, chatId, fromId);
    if (/^\/link(@\w+)?/.test(text)) return this.onLinkCommand(c, chatId, fromId, text);
    if (/^\/help(@\w+)?/.test(text)) {
      return sendMessage(c.token, chatId,
        '🛠 <b>Бот продавца</b>\n\n' +
        '/start — панель продавца\n' +
        '/mystores — список моих витрин\n' +
        '/link &lt;store_id&gt; — ссылка-приглашение для покупателей\n\n' +
        'Покупатель попадает в витрину только по ссылке из этого бота — она открывает <b>бота покупателя</b>.');
    }
    // Неизвестный текст — показываем главное меню (без затирания контекста).
    if (text.startsWith('/')) return this.onStart(c, chatId, fromId);
  },

  async onStart(c, chatId) {
    return sendMessage(c.token, chatId,
      '🛒 <b>Панель продавца</b>\n\n' +
      'Здесь вы создаёте витрину, товары и обрабатываете заказы.\n' +
      'Ссылка из раздела «Мои магазины» открывает покупателю СРАЗУ витрину ' +
      '(Mini App). В бот покупателя он попадёт позже — после заказа и разрешения на сообщения.',
      mainMenu(c.appUrl));
  },

  async onMyStores(c, chatId, fromId) {
    const stores = await getStoresByOwner(c.baseUrl, c.anonKey, fromId);
    if (stores === null) {
      // БД недоступна/не настроена — даём общую инструкцию без списка.
      return sendMessage(c.token, chatId,
        '📊 <b>Мои магазины</b>\n\n' +
        'Откройте панель продавца, создайте витрину — затем вернитесь сюда за ссылкой-приглашением.\n\n' +
        'Формат ссылки: <code>t.me/&lt;buyer_bot&gt;/&lt;app&gt;?startapp=store_&lt;store_id&gt;</code>',
        mainMenu(c.appUrl));
    }
    if (!stores.length) {
      return sendMessage(c.token, chatId,
        '📊 <b>Мои магазины</b>\n\nУ вас пока нет витрин. Создайте первую в панели продавца 👇',
        { inline_keyboard: [[{ text: '🏪 Открыть панель продавца', web_app: { url: sellerAppUrl(c.appUrl) } }]] });
    }
    // По одной кнопке-ссылке на каждую витрину.
    const rows = stores.slice(0, 20).map((s) => ([
      { text: `🔗 Ссылка: ${s.name || s.id.slice(0, 8)}`, callback_data: `seller_link_${s.id}` },
    ]));
    rows.push([{ text: '🏪 Панель продавца', web_app: { url: sellerAppUrl(c.appUrl) } }]);
    return sendMessage(c.token, chatId,
      '📊 <b>Мои магазины</b>\n\nНажмите на магазин, чтобы получить ссылку-приглашение для покупателей.\n' +
      'Эта ссылка открывает <b>бота покупателя</b> сразу в вашей витрине.',
      { inline_keyboard: rows });
  },

  async onLinkCommand(c, chatId, _fromId, text) {
    const parts = text.split(/\s+/);
    const storeId = (parts[1] || '').trim();
    if (!storeId) {
      return sendMessage(c.token, chatId,
        '🔗 <b>Ссылка-приглашение</b>\n\nИспользование: <code>/link &lt;store_id&gt;</code>\n' +
        'Удобнее: /mystores → выбрать витрину → получить готовую ссылку.');
    }
    // Кнопка URL ведёт напрямую в Mini App покупателя (t.me/<buyer>/<app>?startapp=...),
    // а не просто в чат бота — тап сразу открывает витрину.
    return sendMessage(c.token, chatId, inviteText(c, storeId), inviteKeyboard(c, storeId));
  },

  async onCallback(c, q) {
    const chatId = q.message?.chat?.id;
    const messageId = q.message?.message_id;
    const data = q.data || '';
    await answerCallback(c.token, q.id);
    if (!chatId) return;

    if (data === 'seller_main') {
      return editMessage(c.token, chatId, messageId,
        '🛒 <b>Панель продавца</b>\n\nВыберите действие:', mainMenu(c.appUrl));
    }
    if (data === 'seller_my_stores') {
      const fromId = q.from?.id;
      const stores = await getStoresByOwner(c.baseUrl, c.anonKey, fromId);
      if (stores === null || !stores?.length) {
        return editMessage(c.token, chatId, messageId,
          stores === null
            ? '📊 <b>Мои магазины</b>\n\nСоздайте витрину в панели продавца — ссылка-приглашение появится здесь.'
            : '📊 <b>Мои магазины</b>\n\nВитрин пока нет. Создайте первую в панели продавца 👇',
          { inline_keyboard: [[{ text: '🏪 Открыть панель продавца', web_app: { url: sellerAppUrl(c.appUrl) } }], [{ text: '⬅️ Назад', callback_data: 'seller_main' }]] });
      }
      const rows = stores.slice(0, 20).map((s) => ([
        { text: `🔗 Ссылка: ${s.name || s.id.slice(0, 8)}`, callback_data: `seller_link_${s.id}` },
      ]));
      rows.push([{ text: '⬅️ Назад', callback_data: 'seller_main' }]);
      return editMessage(c.token, chatId, messageId,
        '📊 <b>Мои магазины</b>\n\nНажмите на витрину, чтобы получить ссылку-приглашение.',
        { inline_keyboard: rows });
    }
    if (data.startsWith('seller_link_')) {
      const storeId = data.replace('seller_link_', '');
      // Прямая ссылка-кнопка в Mini App покупателя + текст для копирования/пересылки.
      return sendMessage(c.token, chatId, inviteText(c, storeId), inviteKeyboard(c, storeId));
    }
    if (data === 'seller_how_invite') {
      return editMessage(c.token, chatId, messageId,
        'ℹ️ <b>Как пригласить покупателя</b>\n\n' +
        '1. /mystores → выберите витрину\n' +
        '2. Скопируйте ссылку вида <code>t.me/.../...?startapp=store_...</code>\n' +
        '3. Отправьте её покупателю\n\n' +
        'Тап по ссылке открывает СРАЗУ витрину (Mini App), а не чат бота. ' +
        'В бот покупателя человек попадёт после заказа: Mini App официально спросит ' +
        'разрешение на сообщения, и туда придёт «Заказ принят». ' +
        'В том боте у него сохранится список магазинов, корзина/заказы/избранное — отдельно по каждой витрине.',
        { inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'seller_main' }]] });
    }
  },
};

function inviteText(c, storeId) {
  const link = buyerDeepLink(c.buyerUsername, c.buyerApp, storeId);
  return (
    '🔗 <b>Ссылка-приглашение готова</b>\n\n' +
    `<code>${escapeHtml(link)}</code>\n\n` +
    'Она открывает СРАЗУ витрину (Mini App), а не чат бота.\n' +
    'Отправьте ссылку покупателю. В бот покупателя он попадёт после заказа и разрешения на сообщения.\n' +
    'Без этой ссылки попасть в магазин нельзя.'
  );
}

function inviteKeyboard(c, storeId) {
  return {
    inline_keyboard: [[{ text: '🛍️ Открыть витрину (как покупатель)', url: buyerDeepLink(c.buyerUsername, c.buyerApp, storeId) }]],
  };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

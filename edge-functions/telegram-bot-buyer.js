// telegram-bot-buyer.js — webhook edge-функция БОТА ПОКУПАТЕЛЯ.
//
// Роль: единственный бот для всех покупателей и магазинов. Покупатель попадает
// в витрину напрямую (Direct Mini App, `shop_<public_id>`), а в чат бота — после
// заказа/разрешения на сообщения. Поэтому источник «какие витрины он открывал» —
// серверная таблица buyer_store_visits (пишет edge `store-visit` из Mini App),
// а не этот бот.
//
// Функции бота:
//   * ярлык на последнюю открытую витрину (и per-chat кнопка-меню чата);
//   * «Список магазинов» — только посещённые витрины (buyer_store_list_read);
//   * «Активные заказы» — NEW / в пути / доставлено без исхода
//     (buyer_active_orders_read), по всем магазинам покупателя.
//
// Env: BUYER_BOT_TOKEN (fallback BOT_TOKEN), APP_URL, INSFORGE_BASE_URL, API_KEY,
//      BUYER_BOT_USERNAME, BUYER_APP_SHORTNAME, TELEGRAM_WEBHOOK_SECRET?

import { env } from './_shared/env.js';
import { adminClient } from './_shared/clients.js';
import { json, methodNotAllowed, preflight } from './_shared/http.js';
import {
  answerCallback,
  editOrSend,
  sendMessage,
  setStoreMenuButton,
  webhookAuthorized,
} from './_shared/bot-api.js';
import {
  buyerHowKeyboard,
  buyerHowText,
  buyerMainMenu,
  buyerNoStoresText,
  buyerOrdersKeyboard,
  buyerStoreKeyboard,
  buyerStoreWelcomeText,
  buyerStoresView,
  buyerWelcomeGrantText,
  buyerWelcomeText,
  formatBuyerOrdersText,
  normalizeStoreList,
} from './_shared/bot-views.js';

const BOT = 'buyer';

function cfg() {
  return {
    appUrl: env('APP_URL'),
    buyerUsername: env('BUYER_BOT_USERNAME'),
    buyerApp: env('BUYER_APP_SHORTNAME'),
  };
}

function db() {
  const baseUrl = env('INSFORGE_BASE_URL');
  if (!baseUrl) return null;
  try {
    return adminClient(baseUrl);
  } catch (e) {
    console.error('[buyer-bot] admin client error:', e);
    return null;
  }
}

async function resolveUserId(telegramId) {
  const client = db();
  if (!client || !telegramId) return null;
  try {
    const { data } = await client.database
      .from('telegram_identities')
      .select('user_id')
      .eq('telegram_user_id', String(telegramId))
      .limit(1);
    return data?.[0]?.user_id ?? null;
  } catch (e) {
    console.error('[buyer-bot] identity lookup error:', e);
    return null;
  }
}

/** Витрины покупателя: только те, что он открывал (по last_visited_at desc). */
async function loadStores(userId) {
  const client = db();
  if (!client || !userId) return [];
  try {
    const { data, error } = await client.database.rpc('buyer_store_list_read', {
      p_actor_user_id: userId,
    });
    if (error) throw error;
    return normalizeStoreList(data);
  } catch (e) {
    console.error('[buyer-bot] store list error:', e);
    return [];
  }
}

/** Активные заказы покупателя по всем магазинам. */
async function loadActiveOrders(userId) {
  const client = db();
  if (!client || !userId) return { orders: [], total: 0 };
  try {
    const { data, error } = await client.database.rpc('buyer_active_orders_read', {
      p_actor_user_id: userId,
      p_limit: 20,
    });
    if (error) throw error;
    const payload = Array.isArray(data) ? data[0] : data;
    if (!payload || typeof payload !== 'object') return { orders: [], total: 0 };
    return { orders: payload.orders ?? [], total: payload.total ?? 0 };
  } catch (e) {
    console.error('[buyer-bot] active orders error:', e);
    return { orders: [], total: 0 };
  }
}

/** Согласие на сообщения (write access) → фиксируем флаг уведомлений на сервере. */
async function markNotificationsEnabled(userId) {
  const client = db();
  if (!client || !userId) return;
  try {
    const { error } = await client.database
      .from('telegram_identities')
      .update({
        notifications_enabled: true,
        notifications_enabled_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw error;
  } catch (e) {
    console.error('[buyer-bot] notifications flag error:', e);
  }
}

/** Зафиксировать открытие витрины (на случай входа по ссылке в чат бота). */
async function recordVisit(userId, publicId) {
  const client = db();
  if (!client || !userId || !publicId) return null;
  try {
    const { data, error } = await client.database.rpc('buyer_store_visit_upsert', {
      p_actor_user_id: userId,
      p_store_ref: publicId,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (e) {
    console.error('[buyer-bot] visit upsert error:', e);
    return null;
  }
}

// /start shop_<public_id> | /start store_<id> (legacy) | /start <public_id>
function parseStartParam(text) {
  const m = String(text || '')
    .trim()
    .match(/^\/start(@\S+)?\s*(.*)$/);
  if (!m) return '';
  return (m[2] || '').trim();
}

/** Возвращает public_id (канон) или legacy-значение; пустая строка — нет ссылки. */
function extractStoreId(param) {
  if (!param) return '';
  const p = param.trim();
  if (p.toLowerCase().startsWith('shop_')) return p.slice(5).trim();
  if (p.toLowerCase().startsWith('store_') || p.toLowerCase().startsWith('store-')) {
    return p.slice(6).trim();
  }
  return p.split(/\s+/)[0];
}

/** Вход по ссылке продавца: витрина открыта в Mini App, фиксируем визит. */
async function onStoreEntry(chatId, tgUser, publicId) {
  const c = cfg();
  const userId = await resolveUserId(tgUser.id);
  const visit = await recordVisit(userId, publicId);
  if (!visit) {
    return sendMessage(
      BOT,
      chatId,
      '😕 <b>Витрина не найдена</b>\n\nВозможно, продавец удалил магазин или ссылка устарела. Попросите новую ссылку.',
    );
  }
  if (userId) await setStoreMenuButton(chatId, visit.name, publicId);
  return sendMessage(
    BOT,
    chatId,
    buyerStoreWelcomeText(visit.name),
    buyerStoreKeyboard(c.buyerUsername, c.buyerApp, publicId),
  );
}

/** /start без ссылки: последняя витрина + меню. */
async function onMain(chatId, tgUser, { edit = false, messageId, granted = false } = {}) {
  const c = cfg();
  const userId = await resolveUserId(tgUser.id);
  const stores = await loadStores(userId);
  const lastStore = stores[0] ?? null;
  if (lastStore?.publicId) await setStoreMenuButton(chatId, lastStore.name, lastStore.publicId);
  const text = granted ? buyerWelcomeGrantText(lastStore) : buyerWelcomeText(lastStore);
  const kb = buyerMainMenu({
    botUsername: c.buyerUsername,
    appShortname: c.buyerApp,
    lastStore,
  });
  return edit ? editOrSend(BOT, chatId, messageId, text, kb) : sendMessage(BOT, chatId, text, kb);
}

async function onMyShops(chatId, tgUser, { edit = false, messageId } = {}) {
  const c = cfg();
  const userId = await resolveUserId(tgUser.id);
  const stores = await loadStores(userId);
  if (!stores.length) {
    const text = buyerNoStoresText();
    const kb = buyerHowKeyboard();
    return edit ? editOrSend(BOT, chatId, messageId, text, kb) : sendMessage(BOT, chatId, text, kb);
  }
  const view = buyerStoresView({
    stores,
    botUsername: c.buyerUsername,
    appShortname: c.buyerApp,
  });
  return edit
    ? editOrSend(BOT, chatId, messageId, view.text, view.keyboard)
    : sendMessage(BOT, chatId, view.text, view.keyboard);
}

async function onOrders(chatId, tgUser, { edit = false, messageId } = {}) {
  const userId = await resolveUserId(tgUser.id);
  const result = await loadActiveOrders(userId);
  const text = formatBuyerOrdersText(result);
  const kb = buyerOrdersKeyboard();
  return edit ? editOrSend(BOT, chatId, messageId, text, kb) : sendMessage(BOT, chatId, text, kb);
}

function onHelp(chatId) {
  return sendMessage(
    BOT,
    chatId,
    '🛍 <b>Справка</b>\n\n' +
      '/start — главное меню\n' +
      '/myshops — магазины, которые вы открывали\n' +
      '/orders — активные заказы\n\n' +
      'В магазин можно попасть только по ссылке-приглашению от продавца. ' +
      'Уведомления о заказе и смене статуса приходят сюда, если вы разрешили сообщения.',
  );
}

async function onCallback(q) {
  const chatId = q.message?.chat?.id;
  const messageId = q.message?.message_id;
  const data = q.data || '';
  const tgUser = q.from || {};
  await answerCallback(BOT, q.id);
  if (!chatId) return;

  if (data === 'buyer_menu') return onMain(chatId, tgUser, { edit: true, messageId });
  if (data === 'buyer_myshops') return onMyShops(chatId, tgUser, { edit: true, messageId });
  if (data === 'buyer_orders' || data === 'buyer_orders_refresh') {
    return onOrders(chatId, tgUser, { edit: true, messageId });
  }
  if (data === 'buyer_how') {
    return editOrSend(BOT, chatId, messageId, buyerHowText(), buyerHowKeyboard());
  }
}

async function handleUpdate(update) {
  if (update.callback_query) return onCallback(update.callback_query);
  const msg = update.message || update.edited_message;
  if (!msg?.chat?.id) return;
  const chatId = msg.chat.id;
  const tgUser = msg.from || {};

  // Пользователь разрешил боту писать (Mini App requestWriteAccess / Start-меню) —
  // фиксируем флаг уведомлений и присылаем приветствие с меню.
  if (msg.write_access_allowed) {
    await markNotificationsEnabled(await resolveUserId(tgUser.id));
    return onMain(chatId, tgUser, { granted: true });
  }

  const text = (msg.text || '').trim();
  // Прочие сервисные сообщения (без текста) игнорируем.
  if (!text) return;

  if (/^\/start(@\w+)?(\s|$)/.test(text)) {
    const storeRef = extractStoreId(parseStartParam(text));
    if (storeRef) return onStoreEntry(chatId, tgUser, storeRef);
    return onMain(chatId, tgUser);
  }
  if (/^\/myshops(@\w+)?|^\/mystores(@\w+)?/.test(text)) {
    return onMyShops(chatId, tgUser, {});
  }
  if (/^\/orders(@\w+)?(\s|$)/.test(text)) return onOrders(chatId, tgUser, {});
  if (/^\/help(@\w+)?/.test(text)) return onHelp(chatId);
  if (text.startsWith('/')) return onMain(chatId, tgUser);
  return sendMessage(
    BOT,
    chatId,
    '🔗 Чтобы попасть в магазин, нужна ссылка-приглашение от продавца.\n' +
      'Если вы уже переходили по ссылкам — откройте /myshops.',
  );
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return methodNotAllowed();
  if (!webhookAuthorized(request)) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }
  try {
    const update = await request.json();
    await handleUpdate(update);
  } catch (e) {
    console.error('[buyer-bot] handle error:', e);
  }
  return json({ ok: true });
}

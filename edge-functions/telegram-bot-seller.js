// telegram-bot-seller.js — webhook edge-функция БОТА ПРОДАВЦА.
//
// Роль: только продавец. /start — приветствие и меню из трёх функций:
//   1) «Создать магазин» → после создания «Управление магазином» (web_app панели
//      продавца, APP_URL?startapp=seller);
//   2) «Статистика» — посетители/заказы/доходы магазина (RPC seller_bot_stats_read);
//   3) «Ссылка покупателям» — Direct Mini App ссылка на витрину покупателя.
// Состояние (есть магазин или нет) определяется по БД при каждом входе — Mini App
// не может отредактировать сообщение бота, поэтому меню пересчитывается.
//
// Env: SELLER_BOT_TOKEN (fallback BOT_TOKEN), APP_URL, INSFORGE_BASE_URL, API_KEY,
//      BUYER_BOT_USERNAME, BUYER_APP_SHORTNAME, TELEGRAM_WEBHOOK_SECRET?
//
// Webhook: POST от Telegram → 200 {"ok":true}; апдейт обрабатывается ДО ответа
// (await), чтобы доставка сообщений не терялась.

import { env } from './_shared/env.js';
import { adminClient } from './_shared/clients.js';
import { json, methodNotAllowed, preflight } from './_shared/http.js';
import { answerCallback, editOrSend, sendMessage, webhookAuthorized } from './_shared/bot-api.js';
import {
  formatSellerInviteText,
  formatSellerStatsText,
  sellerBackKeyboard,
  sellerInviteKeyboard,
  sellerMainMenu,
  sellerNeedStoreKeyboard,
  sellerNeedStoreText,
  sellerWelcomeText,
} from './_shared/bot-views.js';

const BOT = 'seller';

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
    console.error('[seller-bot] admin client error:', e);
    return null;
  }
}

/**
 * Продавец и его магазин по telegram id. Один магазин на продавца — берём первый
 * (как и панель: loadSellerStore). null — БД недоступна; { userId, store: null } —
 * продавец ещё без магазина.
 */
async function getSeller(telegramId) {
  const client = db();
  if (!client || !telegramId) return null;
  try {
    const { data: identity } = await client.database
      .from('telegram_identities')
      .select('user_id')
      .eq('telegram_user_id', String(telegramId))
      .limit(1);
    const userId = identity?.[0]?.user_id;
    if (!userId) return { userId: null, store: null };

    const { data: stores } = await client.database
      .from('stores')
      .select('id,name,public_id')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);
    return { userId, store: stores?.[0] ?? null };
  } catch (e) {
    console.error('[seller-bot] seller lookup error:', e);
    return null;
  }
}

/** Агрегаты статистики (owner-check внутри RPC по p_actor_user_id). */
async function loadStats(userId, publicId) {
  const client = db();
  if (!client || !userId || !publicId) return null;
  try {
    const { data, error } = await client.database.rpc('seller_bot_stats_read', {
      p_actor_user_id: userId,
      p_store_ref: publicId,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (e) {
    console.error('[seller-bot] stats error:', e);
    return null;
  }
}

async function onStart(chatId, fromId) {
  const seller = await getSeller(fromId);
  const store = seller?.store ?? null;
  return sendMessage(
    BOT,
    chatId,
    sellerWelcomeText(store?.name),
    sellerMainMenu({ appUrl: cfg().appUrl, hasStore: Boolean(store) }),
  );
}

async function onStats(chatId, fromId, { edit = false, messageId } = {}) {
  const c = cfg();
  const seller = await getSeller(fromId);
  const store = seller?.store ?? null;
  if (!store) {
    const text = sellerNeedStoreText('stats');
    const kb = sellerNeedStoreKeyboard({ appUrl: c.appUrl });
    return edit ? editOrSend(BOT, chatId, messageId, text, kb) : sendMessage(BOT, chatId, text, kb);
  }
  const stats = await loadStats(seller.userId, store.public_id);
  const text = formatSellerStatsText(stats) ?? sellerNeedStoreText('stats');
  const kb = sellerBackKeyboard();
  return edit ? editOrSend(BOT, chatId, messageId, text, kb) : sendMessage(BOT, chatId, text, kb);
}

async function onInvite(chatId, fromId, { edit = false, messageId } = {}) {
  const c = cfg();
  const seller = await getSeller(fromId);
  const store = seller?.store ?? null;
  if (!store) {
    const text = sellerNeedStoreText('invite');
    const kb = sellerNeedStoreKeyboard({ appUrl: c.appUrl });
    return edit ? editOrSend(BOT, chatId, messageId, text, kb) : sendMessage(BOT, chatId, text, kb);
  }
  const text = formatSellerInviteText(c.buyerUsername, c.buyerApp, store.public_id);
  const kb = sellerInviteKeyboard(c.buyerUsername, c.buyerApp, store.public_id);
  return sendMessage(BOT, chatId, text, kb);
}

function onHelp(chatId) {
  return sendMessage(
    BOT,
    chatId,
    '🛠 <b>Справка</b>\n\n' +
      '/start — панель продавца\n' +
      '/stats — статистика магазина\n' +
      '/mystores — ссылка-приглашение для покупателей\n\n' +
      'Кнопка «Управление магазином» открывает панель (товары, заказы, настройки). ' +
      'Покупатели попадают в витрину только по ссылке из этого бота.',
  );
}

async function onCallback(q) {
  const chatId = q.message?.chat?.id;
  const messageId = q.message?.message_id;
  const data = q.data || '';
  const fromId = q.from?.id;
  await answerCallback(BOT, q.id);
  if (!chatId) return;

  if (data === 'seller_menu') {
    const seller = await getSeller(fromId);
    const store = seller?.store ?? null;
    return editOrSend(
      BOT,
      chatId,
      messageId,
      sellerWelcomeText(store?.name),
      sellerMainMenu({ appUrl: cfg().appUrl, hasStore: Boolean(store) }),
    );
  }
  if (data === 'seller_stats' || data === 'seller_stats_refresh') {
    return onStats(chatId, fromId, { edit: true, messageId });
  }
  if (data === 'seller_invite') {
    return onInvite(chatId, fromId, { edit: true, messageId });
  }
}

async function handleUpdate(update) {
  if (update.callback_query) return onCallback(update.callback_query);
  const msg = update.message || update.edited_message;
  if (!msg?.chat?.id) return;
  const chatId = msg.chat.id;
  const fromId = msg.from?.id;
  const text = (msg.text || '').trim();

  if (/^\/start(@\w+)?(\s|$)/.test(text)) return onStart(chatId, fromId);
  if (/^\/stats(@\w+)?(\s|$)/.test(text)) return onStats(chatId, fromId, {});
  if (/^\/mystores(@\w+)?|^\/link(@\w+)?/.test(text)) return onInvite(chatId, fromId, {});
  if (/^\/help(@\w+)?/.test(text)) return onHelp(chatId);
  if (text.startsWith('/')) return onStart(chatId, fromId);
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
    console.error('[seller-bot] handle error:', e);
  }
  return json({ ok: true });
}

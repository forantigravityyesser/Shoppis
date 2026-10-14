// bot-views.js — чистые построители текстов/клавиатур для ботов (без I/O).
//
// Вынесено из webhook-функций, чтобы тестировать формат без сети и чтобы оба
// бота делили один стиль. Все пользовательские строки экранируются.

import { escapeHtml } from './bot-api.js';
import { formatMoneyMinor } from './order-notify.js';
import { buyerDeepLink } from './telegram.js';

/** Обрезать подпись кнопки/строки (лимит текста кнопки Telegram — 64 символа). */
function truncate(text, max) {
  const s = String(text ?? '').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** URL панели продавца (Admin Mini App). */
export function sellerAppUrl(appUrl) {
  return `${String(appUrl || '').replace(/\/$/, '')}?startapp=seller`;
}

// ────────────────────────────── ПРОДАВЕЦ ──────────────────────────────

/**
 * Главное меню продавца. Кнопка магазина одна и меняет смысл по состоянию:
 * нет магазина → «Создать магазин» (онбординг в приложении), есть → «Управление».
 */
export function sellerMainMenu({ appUrl, hasStore }) {
  const rows = [];
  if (appUrl) {
    rows.push([
      {
        text: hasStore ? '🏪 Управление магазином' : '🛍️ Создать магазин',
        web_app: { url: sellerAppUrl(appUrl) },
      },
    ]);
  }
  rows.push([{ text: '📊 Статистика', callback_data: 'seller_stats' }]);
  rows.push([{ text: '🔗 Ссылка покупателям', callback_data: 'seller_invite' }]);
  return { inline_keyboard: rows };
}

export function sellerWelcomeText(storeName) {
  if (storeName) {
    return (
      '🛒 <b>Панель продавца</b>\n\n' +
      `Магазин: <b>«${escapeHtml(storeName)}»</b>\n\n` +
      'Выберите действие:'
    );
  }
  return (
    '🛒 <b>Панель продавца</b>\n\n' +
    'Здесь создаётся витрина, товары и обрабатываются заказы.\n' +
    'Начните с кнопки «Создать магазин» — после создания она станет «Управление магазином».\n\n' +
    'Выберите действие:'
  );
}

/** Клавиатура экрана статистики / подсказок. */
export function sellerBackKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔄 Обновить', callback_data: 'seller_stats_refresh' }],
      [{ text: '⬅️ Назад', callback_data: 'seller_menu' }],
    ],
  };
}

/** Клавиатура «нужен магазин» (статистика/ссылка до создания витрины). */
export function sellerNeedStoreKeyboard({ appUrl }) {
  const rows = [];
  if (appUrl) {
    rows.push([{ text: '🛍️ Создать магазин', web_app: { url: sellerAppUrl(appUrl) } }]);
  }
  rows.push([{ text: '⬅️ Назад', callback_data: 'seller_menu' }]);
  return { inline_keyboard: rows };
}

export function sellerNeedStoreText(action) {
  const what = action === 'invite' ? 'ссылку для покупателей' : 'статистику';
  return (
    `📭 Сначала создайте магазин\n\n` +
    `Как только витрина появится, здесь можно будет смотреть ${what}.`
  );
}

/**
 * Текст статистики магазина (все данные за всё время, валюта магазина).
 * @param {object} stats — результат RPC seller_bot_stats_read
 */
export function formatSellerStatsText(stats) {
  if (!stats?.store) return null;
  const name = escapeHtml(stats.store.name || 'Магазин');
  const symbol = stats.store.currencySymbol || '';
  const orders = stats.orders || {};
  const money = stats.money || {};
  return [
    `📊 <b>Статистика — «${name}»</b>`,
    '',
    `👀 Посетители: <b>${stats.visitors ?? 0}</b>`,
    `📦 Заказов всего: <b>${orders.total ?? 0}</b> · <b>${formatMoneyMinor(money.ordersTotalMinor ?? 0, symbol)}</b>`,
    `   • Новые: ${orders.new ?? 0}`,
    `   • В пути: ${orders.inTransit ?? 0}`,
    `   • Доставлено: ${orders.delivered ?? 0}`,
    `   • Отказ/отмена: ${orders.history ?? 0}`,
    '',
    `💰 Доход (забрали): <b>${formatMoneyMinor(money.receivedMinor ?? 0, symbol)}</b>`,
    `⏳ Потенциальный доход: <b>${formatMoneyMinor(money.potentialMinor ?? 0, symbol)}</b>`,
  ].join('\n');
}

export function formatSellerInviteText(botUsername, appShortname, publicId) {
  const link = buyerDeepLink(botUsername, appShortname, publicId);
  return (
    '🔗 <b>Ссылка-приглашение готова</b>\n\n' +
    `<code>${escapeHtml(link)}</code>\n\n` +
    'Нажмите «📋 Скопировать ссылку» и отправьте её покупателю — тап открывает витрину сразу (Mini App).\n' +
    'Без этой ссылки попасть в магазин нельзя.'
  );
}

export function sellerInviteKeyboard(botUsername, appShortname, publicId) {
  const link = buyerDeepLink(botUsername, appShortname, publicId);
  return {
    inline_keyboard: [
      [{ text: '📋 Скопировать ссылку', copy_text: { text: link } }],
      [{ text: '🛍️ Открыть витрину (как покупатель)', url: link }],
      [{ text: '⬅️ Назад', callback_data: 'seller_menu' }],
    ],
  };
}

// ────────────────────────────── ПОКУПАТЕЛЬ ──────────────────────────────

/**
 * Главное меню покупателя: ярлык на последнюю открытую витрину (если есть),
 * список магазинов и активные заказы.
 */
export function buyerMainMenu({ botUsername, appShortname, lastStore }) {
  const rows = [];
  if (lastStore?.publicId) {
    rows.push([
      {
        text: `🛍️ Открыть витрину «${truncate(lastStore.name || 'Магазин', 30)}»`,
        url: buyerDeepLink(botUsername, appShortname, lastStore.publicId),
      },
    ]);
  }
  rows.push([{ text: '📋 Список магазинов', callback_data: 'buyer_myshops' }]);
  rows.push([{ text: '📦 Активные заказы', callback_data: 'buyer_orders' }]);
  rows.push([{ text: 'ℹ️ Как это работает', callback_data: 'buyer_how' }]);
  return { inline_keyboard: rows };
}

/**
 * Приветствие при выдаче боту доступа к сообщениям (write_access_allowed).
 * Покупатель только что разрешил уведомления — знакомим с ботом и возможностями.
 */
export function buyerWelcomeGrantText(lastStore) {
  const last =
    lastStore?.publicId
      ? `\n\nПоследняя витрина: <b>«${escapeHtml(lastStore.name || 'Магазин')}»</b> — откройте её кнопкой ниже.`
      : '\n\nНачните с перехода по ссылке-приглашению от продавца.';
  return (
    '🎉 <b>Уведомления включены!</b>\n\n' +
    'Добро пожаловать в <b>Shoppis</b> — здесь живут магазины, которые вы открываете.\n\n' +
    'В этом боте можно:\n' +
    '• 🛍 переходить в магазины и делать заказы\n' +
    '• 📦 следить за статусом заказов и доставкой\n' +
    '• 📋 возвращаться к витринам в один тап\n' +
    '• 🔔 получать уведомления о заказах и акциях' +
    last
  );
}

export function buyerWelcomeText(lastStore) {
  if (lastStore?.publicId) {
    return (
      '🛍 <b>Бот покупателя</b>\n\n' +
      `Последняя витрина: <b>«${escapeHtml(lastStore.name || 'Магазин')}»</b>.\n\n` +
      'Выберите действие:'
    );
  }
  return (
    '🛍 <b>Бот покупателя</b>\n\n' +
    'Здесь живут магазины, которые вы открывали: заказы, статусы доставки и уведомления.\n\n' +
    'Как начать:\n' +
    '1️⃣ Получите у продавца ссылку-приглашение\n' +
    '2️⃣ Перейдите по ней — витрина откроется сразу\n' +
    '3️⃣ Она появится в «Списке магазинов», а сюда будут приходить уведомления'
  );
}

/**
 * Нормализует ответ RPC `buyer_store_list_read`. Функция возвращает jsonb-массив,
 * который SDK отдаёт как есть; но на случай иной обёртки принимаем и `{value:[...]}`.
 * Невалидный/пустой ответ → пустой список.
 */
export function normalizeStoreList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.value)) return data.value;
  return [];
}

/** Экран «Мои магазины»: название + переход на каждую посещённую витрину. */
export function buyerStoresView({ stores, botUsername, appShortname }) {
  const rows = (stores || []).map((s) => [
    {
      text: `🛍️ ${truncate(s.name || 'Магазин', 40)}`,
      url: buyerDeepLink(botUsername, appShortname, s.publicId),
    },
  ]);
  rows.push([{ text: '⬅️ Назад', callback_data: 'buyer_menu' }]);
  return {
    text:
      '📋 <b>Мои магазины</b>\n\n' +
      'Витрины, которые вы открывали. Корзина, заказы и избранное — свои в каждой.',
    keyboard: { inline_keyboard: rows },
  };
}

export function buyerNoStoresText() {
  return (
    '📋 <b>Мои магазины</b>\n\n' +
    'Пока пусто. Попросите у продавца ссылку-приглашение — после перехода магазин появится здесь.'
  );
}

export const ORDER_STATUS_LABELS = {
  NEW: '🆕 Новый',
  IN_TRANSIT: '🚚 В пути',
  DELIVERED: '📬 Доставлен',
};

export function buyerOrdersKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔄 Обновить', callback_data: 'buyer_orders_refresh' }],
      [{ text: '⬅️ Назад', callback_data: 'buyer_menu' }],
    ],
  };
}

/**
 * Активные заказы покупателя: NEW / в пути / доставлено без исхода
 * (забрали/отказ — завершённые, не показываются).
 * @param {{ orders: Array, total: number }} result — результат RPC buyer_active_orders_read
 */
export function formatBuyerOrdersText(result) {
  const orders = Array.isArray(result?.orders) ? result.orders : [];
  if (!orders.length) {
    return (
      '📦 <b>Активные заказы</b>\n\n' +
      'Активных заказов нет.\n' +
      'Как только оформите заказ, здесь появятся его статус и доставка.'
    );
  }
  const total = Number(result?.total) || orders.length;
  const lines = [`📦 <b>Активные заказы</b> (${total})`, ''];
  for (const o of orders) {
    const label = ORDER_STATUS_LABELS[o.status] || escapeHtml(o.status || '');
    lines.push(`• <b>${escapeHtml(o.storeName || 'Магазин')}</b> — №${escapeHtml(o.publicOrderNumber || '')}`);
    lines.push(`   ${label} · ${formatMoneyMinor(o.totalMinor, o.currencySymbol || '')}`);
  }
  if (total > orders.length) {
    lines.push('', `…и ещё ${total - orders.length}. Полный список — в витрине.`);
  }
  return lines.join('\n');
}

/** Экран входа по ссылке продавца: витрина уже открыта в Mini App. */
export function buyerStoreWelcomeText(storeName) {
  const name = storeName ? ` «${escapeHtml(storeName)}»` : '';
  return (
    `✅ <b>Добро пожаловать${name}!</b>\n\n` +
    'Витрина открыта в Mini App. Корзина, заказы и избранное здесь — только этого магазина.\n' +
    'После оформления заказа Mini App предложит включить уведомления — нажмите «Разрешить», ' +
    'и сюда придёт «Заказ принят», а затем статусы. Это необязательно: заказ работает и без разрешения.'
  );
}

export function buyerStoreKeyboard(botUsername, appShortname, publicId) {
  return {
    inline_keyboard: [
      [{ text: '🛍️ Открыть витрину', url: buyerDeepLink(botUsername, appShortname, publicId) }],
      [{ text: '📋 Мои магазины', callback_data: 'buyer_myshops' }],
    ],
  };
}

export function buyerHowText() {
  return (
    'ℹ️ <b>Как это работает</b>\n\n' +
    '1. Продавец создаёт витрину и присылает вам ссылку-приглашение\n' +
    '2. Вы переходите — витрина открывается сразу (Mini App)\n' +
    '3. Корзина, заказы и избранное — отдельные в каждом магазине\n' +
    '4. Магазин сохраняется в «Списке магазинов», сюда приходят уведомления о заказах\n\n' +
    'Без ссылки продавца попасть в чужую витрину нельзя.'
  );
}

export function buyerHowKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📋 Список магазинов', callback_data: 'buyer_myshops' }],
      [{ text: '⬅️ Назад', callback_data: 'buyer_menu' }],
    ],
  };
}

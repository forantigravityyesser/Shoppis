// order-notify.js — единый источник «писем» о заказах: кому и что шлём.
//
// Чистые функции без сети:
//   * resolveOrderNotifications(...) — какие события/получатели порождает действие;
//   * formatOrderNotification(...)  — HTML-текст + контакт (кнопка) для получателя.
// Отправку выполняет _shared/telegram.notify (best-effort, вне транзакции заказа).
//
// Тексты — под parse_mode=HTML. Внутренние id наружу не отдаём (docs/22 §3.1).
// Контакт: buyer → `stores.support_handle`; seller → TG-снимок покупателя. Если
// контакт невалиден/отсутствует — кнопки и строки-подсказки в письме нет.

const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

/** Подписи inline-кнопки контакта. */
export const CONTACT_LABEL_SELLER = '💬 Написать продавцу';
export const CONTACT_LABEL_BUYER = '💬 Написать покупателю';

/**
 * Нормализует Telegram-username до чистого вида (`@john`, `t.me/john`,
 * `https://t.me/john` → `john`). Невалиден/пусто → ''. Edge-дубль
 * `src/domain/rules/store-contact-rules.ts` (frontend).
 * @returns {string}
 */
export function normalizeTelegramUsername(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  let value = raw
    .replace(/^https?:\/\//i, '')
    .replace(/^telegram\.me\//i, '')
    .replace(/^t\.me\//i, '');
  value = (value.split(/[?#]/)[0] ?? '').replace(/^@/, '').replace(/\/+$/, '');
  return USERNAME_RE.test(value) ? value : '';
}

/** Публичная ссылка на контакт в Telegram; null, если username невалиден. */
export function telegramContactUrl(username) {
  const handle = normalizeTelegramUsername(username);
  return handle ? `https://t.me/${handle}` : null;
}

/**
 * Minor units → человекочитаемая сумма (зеркало frontend `formatMoneyMinor`).
 * Например, 125000 «₽» → «1250 ₽».
 */
export function formatMoneyMinor(minor, symbol = '') {
  const n = Number(minor);
  if (!Number.isFinite(n)) return String(symbol || '').trim();
  const value = String(Number((n / 100).toFixed(2)));
  return symbol ? `${value} ${symbol}` : value;
}

/**
 * Какие уведомления порождает действие с заказом.
 * @param {{ action?: string, actorType?: string, outcome?: string|null, status?: string|null }} input
 * @returns {Array<{ recipient: 'buyer'|'seller', event: string }>}
 */
export function resolveOrderNotifications({ action, actorType, outcome, status } = {}) {
  switch (action) {
    case 'transition':
      if (status === 'IN_TRANSIT') return [{ recipient: 'buyer', event: 'STATUS_IN_TRANSIT' }];
      if (status === 'DELIVERED') return [{ recipient: 'buyer', event: 'STATUS_DELIVERED' }];
      return [];
    case 'delivery-outcome':
      if (outcome === 'RECEIVED') return [{ recipient: 'buyer', event: 'OUTCOME_RECEIVED' }];
      if (outcome === 'REFUSED') return [{ recipient: 'buyer', event: 'OUTCOME_REFUSED' }];
      return [];
    case 'cancel':
      if (actorType === 'buyer') {
        return [
          { recipient: 'buyer', event: 'BUYER_CANCELLED' },
          { recipient: 'seller', event: 'BUYER_CANCELLED' },
        ];
      }
      if (actorType === 'seller') return [{ recipient: 'buyer', event: 'SELLER_CANCELLED' }];
      return [];
    default:
      return [];
  }
}

/** Строка-подсказка о контакте для события/получателя (null — не показывать). */
function contactHint(event, recipient) {
  if (recipient === 'seller') {
    return event === 'ORDER_CREATED' ? 'Нужно уточнить детали? Напишите покупателю.' : null;
  }
  switch (event) {
    case 'ORDER_CREATED':
      return 'Есть вопросы по заказу? Напишите продавцу.';
    case 'STATUS_IN_TRANSIT':
      return 'Вопросы по доставке? Напишите продавцу.';
    case 'STATUS_DELIVERED':
      return 'При получении возникнут вопросы — напишите продавцу.';
    case 'OUTCOME_RECEIVED':
      return 'Возникнут вопросы по товару — напишите продавцу.';
    case 'OUTCOME_REFUSED':
      return 'Что-то пошло не так? Свяжитесь с продавцом.';
    case 'BUYER_CANCELLED':
      return 'Есть вопросы? Напишите продавцу.';
    case 'SELLER_CANCELLED':
      return 'Остались вопросы — напишите продавцу.';
    default:
      return null;
  }
}

/** Подпись кнопки контакта для события/получателя (null — кнопки нет). */
function contactLabel(event, recipient) {
  if (recipient === 'buyer') return CONTACT_LABEL_SELLER;
  if (recipient === 'seller' && event === 'ORDER_CREATED') return CONTACT_LABEL_BUYER;
  return null;
}

const REASON_LINE = {
  BUYER_CHANGED_MIND:
    'Жаль, что в этот раз вы передумали. Будем ждать вас снова — у нас появляются новые товары!',
  COULD_NOT_CONTACT_BUYER:
    'К сожалению, нам не удалось с вами связаться, и заказ не был получен. Будем ждать вас снова в нашем магазине!',
  DELIVERY_TERMS:
    'Похоже, условия доставки не подошли. Будем рады видеть вас снова — подберём что-то удобнее!',
  PRODUCT_NOT_MATCHED_EXPECTATIONS:
    'Жаль, что товар не оправдал ожиданий. Заглядывайте снова — появятся новые варианты!',
  OTHER:
    'К сожалению, в этот раз забрать заказ не получилось. Будем ждать вас снова в нашем магазине!',
};

/** Экранирует HTML-спецсимволы в пользовательских данных (parse_mode=HTML). */
function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** В письме показываем не более стольких позиций (далее — «… и ещё N»). */
const MAX_ITEMS_IN_MESSAGE = 8;

/**
 * Блок позиций: `• Название — Размер × N — сумма`.
 * @param {Array} items
 * @param {{ currencySymbol?: string, showSum?: boolean }} [opts]
 */
function itemsBlock(items, { currencySymbol = '', showSum = true } = {}) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return '';
  const shown = list.slice(0, MAX_ITEMS_IN_MESSAGE);
  const lines = shown.map((it) => {
    const title = htmlEscape(it?.title || 'Товар');
    const variant = it?.variantLabel ? ` — ${htmlEscape(it.variantLabel)}` : '';
    const qty = it?.quantity ? ` × ${it.quantity}` : '';
    const sum =
      showSum && Number.isFinite(Number(it?.lineTotalMinor))
        ? ` — ${formatMoneyMinor(it.lineTotalMinor, currencySymbol)}`
        : '';
    return `• ${title}${variant}${qty}${sum}`;
  });
  if (list.length > shown.length) lines.push(`… и ещё ${list.length - shown.length}`);
  return lines.join('\n');
}

/** Блок доставки для сверки: получатель / телефон / адрес. */
function deliveryBlock(delivery) {
  if (!delivery) return '';
  const parts = [];
  if (delivery.fullName) parts.push(`Получатель: ${htmlEscape(delivery.fullName)}`);
  if (delivery.phone) parts.push(`Телефон: ${htmlEscape(delivery.phone)}`);
  if (delivery.address) parts.push(`Адрес: ${htmlEscape(delivery.address)}`);
  return parts.join('\n');
}

/** Секция «Ваш заказ + Итого + Доставка» в письмах покупателю. */
function buyerVerificationSection({ items, delivery, amount, currencySymbol }) {
  const parts = [];
  const goods = itemsBlock(items, { currencySymbol, showSum: true });
  if (goods) parts.push(`<b>Ваш заказ:</b>\n${goods}`);
  if (amount) parts.push(`Итого: <b>${amount}</b>`);
  const shipping = deliveryBlock(delivery);
  if (shipping) parts.push(`<b>Доставка:</b>\n${shipping}`);
  return parts.join('\n\n');
}

/** Тело письма (без строки-подсказки о контакте). */
function messageBody({
  event,
  recipient,
  number,
  amount,
  itemCount,
  reasonCode,
  items,
  delivery,
  currencySymbol,
}) {
  if (recipient === 'seller') {
    if (event === 'ORDER_CREATED') {
      const list = Array.isArray(items) ? items : [];
      const goods = itemsBlock(list, { showSum: false });
      let tail = '';
      if (goods) tail = `\n\n<b>Товары (${list.length}):</b>\n${goods}`;
      else if (Number.isFinite(Number(itemCount)) && Number(itemCount) > 0) {
        tail = `\nПозиций: ${itemCount}`;
      }
      return `🔔 <b>Новый заказ!</b>\n\nНомер: <code>${number}</code>\nСумма: <b>${amount}</b>${tail}\n\nОткройте панель продавца, чтобы собрать и отправить заказ.`;
    }
    if (event === 'BUYER_CANCELLED') {
      return `⚠️ <b>Покупатель отменил заказ</b>\n\nНомер: <code>${number}</code>\nСумма: <b>${amount}</b>\n\nБронь снята, товар возвращён в наличие.`;
    }
    return null;
  }

  const details = buyerVerificationSection({ items, delivery, amount, currencySymbol });
  const tail = details ? `\n\n${details}` : '';

  switch (event) {
    case 'ORDER_CREATED':
      return `✅ <b>Заказ оформлен!</b>\n\nНомер: <code>${number}</code>\nСтатус: Новый${tail}\n\nПродавец получил ваш заказ и скоро приступит к сборке. Мы сообщим, когда заказ отправится в путь.`;
    case 'STATUS_IN_TRANSIT':
      return `🚚 <b>Заказ в пути!</b>\n\nНомер: <code>${number}</code>${tail}\n\nПродавец передал заказ в доставку. Как только он прибудет в пункт выдачи, мы сразу вам напишем.`;
    case 'STATUS_DELIVERED':
      return `📬 <b>Заказ доставлен!</b>\n\nНомер: <code>${number}</code>${tail}\n\nВаш заказ прибыл в пункт выдачи. Пожалуйста, заберите его в удобное время.`;
    case 'OUTCOME_RECEIVED':
      return `💚 <b>Спасибо за покупку!</b>\n\nЗаказ <code>${number}</code> получен.\n\nСпасибо, что выбрали наш магазин! Будем рады видеть вас снова 🙌`;
    case 'OUTCOME_REFUSED':
      return `🤝 <b>Заказ не получен</b>\n\nНомер: <code>${number}</code>\n\n${REASON_LINE[reasonCode] || REASON_LINE.OTHER}`;
    case 'BUYER_CANCELLED':
      return `🚫 <b>Заказ отменён</b>\n\nНомер: <code>${number}</code>\n\nВы отменили этот заказ. Если отмена была случайной — товар снова в наличии, оформите заказ заново.`;
    case 'SELLER_CANCELLED':
      return `🚫 <b>Заказ отменён</b>\n\nНомер: <code>${number}</code>\n\nК сожалению, продавец отменил этот заказ. Товар снова в наличии — вы можете оформить заказ заново или выбрать другое.`;
    default:
      return null;
  }
}

/**
 * Собирает письмо для получателя.
 * @param {{
 *   event: string, recipient: 'buyer'|'seller', orderNumber?: string,
 *   totalMinor?: number, currencySymbol?: string, itemCount?: number,
 *   reasonCode?: string|null, contactHandle?: string|null,
 *   items?: Array<{ title: string, variantLabel: string, quantity: number, lineTotalMinor: number }>,
 *   delivery?: { fullName?: string, phone?: string, address?: string }|null
 * }} input
 * @returns {{ text: string, contact: { label: string, url: string } | null } | null}
 *   null — событие не имеет письма для этого получателя.
 */
export function formatOrderNotification({
  event,
  recipient,
  orderNumber,
  totalMinor,
  currencySymbol,
  itemCount,
  reasonCode,
  contactHandle,
  items,
  delivery,
} = {}) {
  const number = String(orderNumber ?? '').slice(0, 12);
  const amount = formatMoneyMinor(totalMinor, currencySymbol);
  const body = messageBody({
    event,
    recipient,
    number,
    amount,
    itemCount,
    reasonCode,
    items,
    delivery,
    currencySymbol,
  });
  if (!body) return null;

  const url = telegramContactUrl(contactHandle);
  const label = contactLabel(event, recipient);
  const hint = url && label ? contactHint(event, recipient) : null;

  return {
    text: hint ? `${body}\n\n${hint}` : body,
    contact: url && label ? { label, url } : null,
  };
}

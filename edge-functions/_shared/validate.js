// validate.js — единая серверная валидация входных параметров edge-контура заказов
// (docs/24 §2.7 D1 / ORD-HARDEN-07).
//
// Клиент недоверенный: невалидный uuid/limit/cursor/enum должен получить 400 с
// машинным кодом, а не PostgREST-ошибку 500. Валидация не заменяет SQL-авторизацию —
// она лишь приводит контракт запроса к детерминированному 400.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Значение из разрешённого набора строк; иначе null. */
export function parseEnum(value, allowed) {
  return typeof value === 'string' && allowed.includes(value) ? value : null;
}

/**
 * Limit: отсутствует → fallback; не число → ошибка; число → clamp в [min, max].
 * @returns {{ ok: true, value: number } | { ok: false }}
 */
export function parseLimit(value, { min = 1, max = 50, fallback = 20 } = {}) {
  if (value == null) return { ok: true, value: fallback };
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n)) return { ok: false };
  return { ok: true, value: Math.min(Math.max(n, min), max) };
}

/**
 * Keyset-cursor `<epoch_microseconds>:<uuid>` (конвенция 0026/0046). Пустой/null —
 * валиден (первая страница). Иначе строка строго заданной формы.
 */
export function isValidCursor(value) {
  if (value == null || value === '') return true;
  if (typeof value !== 'string') return false;
  const sep = value.indexOf(':');
  if (sep <= 0) return false;
  const ts = value.slice(0, sep);
  const id = value.slice(sep + 1);
  return /^\d+$/.test(ts) && isUuid(id);
}

/**
 * Положительное целое в [1, max].
 * @returns {number | null}
 */
export function parsePositiveInt(value, max = Number.MAX_SAFE_INTEGER) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

export const ORDER_ACTION_ACTIONS = ['cancel', 'transition', 'delivery-outcome', 'reconcile'];
export const ORDER_ACTOR_TYPES = ['buyer', 'seller'];
export const ORDER_STATUSES = ['NEW', 'IN_TRANSIT', 'DELIVERED', 'REFUSED', 'CANCELLED'];
export const DELIVERY_OUTCOMES = ['RECEIVED', 'REFUSED'];

/**
 * Валидация входа `order-actions` (docs/24 §2.7 D1 / ORD-HARDEN-07): невалидный
 * action/uuid/enum получает 400 с машинным кодом. `actorType` больше не
 * «схлопывается» в seller — принимается только 'buyer'|'seller'.
 * @returns {{ action: string, actorType?: string } | { error: string }}
 */
export function validateOrderAction(body) {
  const action = typeof body?.action === 'string' ? body.action : '';
  if (!ORDER_ACTION_ACTIONS.includes(action)) return { error: 'UNKNOWN_ACTION' };

  if (action === 'cancel') {
    if (!isUuid(body.orderId)) return { error: 'INVALID_ORDER_ID' };
    const actorType = parseEnum(body.actorType, ORDER_ACTOR_TYPES);
    if (actorType === null) return { error: 'INVALID_ACTOR' };
    return { action, actorType };
  }
  if (action === 'transition') {
    if (!isUuid(body.orderId)) return { error: 'INVALID_ORDER_ID' };
    if (parseEnum(body.toStatus, ORDER_STATUSES) === null) return { error: 'INVALID_TO_STATUS' };
    return { action };
  }
  if (action === 'delivery-outcome') {
    if (!isUuid(body.orderId)) return { error: 'INVALID_ORDER_ID' };
    if (parseEnum(body.outcome, DELIVERY_OUTCOMES) === null) return { error: 'INVALID_OUTCOME' };
    return { action };
  }
  // reconcile
  if (!isUuid(body.variantId)) return { error: 'INVALID_VARIANT_ID' };
  if (parsePositiveInt(body.quantity) === null) return { error: 'INVALID_QUANTITY' };
  if (body.orderId != null && !isUuid(body.orderId)) return { error: 'INVALID_ORDER_ID' };
  return { action };
}

import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../../domain/models/order';
import {
  isDeliveryOutcome,
  isOrderStatus,
  isRefusalReasonCode,
} from '../../domain/constants/order-statuses';
import { currencySymbol } from '../../domain/constants/currencies';
import type {
  OrderContact,
  OrderDelivery,
  OrderDetails,
  OrderItemView,
  OrderListPage,
  OrderListItem,
  OrderPreviewItem,
  SalesListPage,
} from '../read-models/order';

/**
 * Нормализует ответы edge `order-queries` (JSON-проекции `order_list_read` /
 * `order_detail_read`) в read models (docs/22 §5.3).
 *
 * Строгость как у остальных commerce-проекций (cart/storefront-mappers): типобезопасный
 * доступ к `unknown`, деньги/количества — конечные неотрицательные числа, отсутствующие
 * optional-поля (`image`, `username`, `supportHandle`, `variantLabel`) → `null`.
 * Показатель «+N» не вычисляется здесь: маппер отдаёт `itemCount` + `previewItems`,
 * а счётчик расхождения — за UI.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** Конечное число (принимает numeric-строки); иначе null. */
function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Деньги в minor units: неотрицательное конечное число или 0. */
function parseMoney(value: unknown): number {
  const n = parseNumber(value);
  return n !== null && n >= 0 ? n : 0;
}

/** Количество: неотрицательное конечное число или 0. */
function parseCount(value: unknown): number {
  const n = parseNumber(value);
  return n !== null && n >= 0 ? n : 0;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Enum-safety (docs/24 §2.4, ORD-HARDEN-06): неизвестное значение не проходит
 * сквозь cast. Статус валидируется `orders_status_check` в БД, поэтому fallback
 * `'NEW'` — чисто защитный (достижим лишь при битой проекции).
 */
function asStatus(value: unknown): OrderStatus {
  const s = asString(value);
  return isOrderStatus(s) ? s : 'NEW';
}

function asRefusalReasonCode(value: unknown): RefusalReasonCode | null {
  const s = asNullableString(value);
  return isRefusalReasonCode(s) ? s : null;
}

function asDeliveryOutcome(value: unknown): DeliveryOutcome | null {
  const s = asNullableString(value);
  return isDeliveryOutcome(s) ? s : null;
}

/**
 * Исторический символ валюты (docs/24 §3.3): значение проекции, иначе
 * детерминированный fallback по сохранённому `currency_code`.
 */
function asSymbol(value: unknown, code: string): string {
  const s = asString(value);
  return s !== '' ? s : currencySymbol(code);
}

function mapLinkingAttributes(raw: unknown): Array<{ name: string; value: string }> {
  return asArray(raw).map((entry) => {
    const item = isRecord(entry) ? entry : {};
    return { name: asString(item.name), value: asString(item.value) };
  });
}

export function mapOrderPreviewItem(raw: unknown): OrderPreviewItem {
  const item = isRecord(raw) ? raw : {};
  return {
    imageUrl: asNullableString(item.imageUrl),
    title: asString(item.title),
    variantLabel: asNullableString(item.variantLabel),
    quantity: parseCount(item.quantity),
  };
}

export function mapOrderListItem(raw: unknown): OrderListItem {
  const item = isRecord(raw) ? raw : {};
  const currencyCode = asString(item.currencyCode);
  return {
    id: asString(item.id),
    publicOrderNumber: asString(item.publicOrderNumber),
    status: asStatus(item.status),
    createdAt: asString(item.createdAt),
    totalMinor: parseMoney(item.totalMinor),
    currencyCode,
    currencySymbol: asSymbol(item.currencySymbol, currencyCode),
    itemCount: parseCount(item.itemCount),
    previewItems: asArray(item.previewItems).map(mapOrderPreviewItem),
  };
}

/** Пустая страница — безопасный результат при невалидной проекции. */
function emptyOrderListPage(): OrderListPage {
  return { orders: [], nextCursor: null };
}

export function mapOrderListPage(raw: unknown): OrderListPage {
  if (!isRecord(raw)) return emptyOrderListPage();
  return {
    orders: asArray(raw.orders).map(mapOrderListItem),
    nextCursor: asNullableString(raw.nextCursor),
  };
}

/**
 * Продажи (docs/25 §3.2): та же проекция `OrderListItem`, плюс сумма всей группы
 * (`totalMinor`) для заголовка секции. Невалидная проекция → пустая страница с 0.
 */
export function mapSalesListPage(raw: unknown): SalesListPage {
  const base = mapOrderListPage(raw);
  const totalMinor = isRecord(raw) ? parseMoney(raw.totalMinor) : 0;
  return { orders: base.orders, nextCursor: base.nextCursor, totalMinor };
}

export function mapOrderItemView(raw: unknown): OrderItemView {
  const item = isRecord(raw) ? raw : {};
  return {
    productTitleSnapshot: asString(item.productTitleSnapshot),
    productImageSnapshot: asNullableString(item.productImageSnapshot),
    variantNameSnapshot: asNullableString(item.variantNameSnapshot),
    variantValueSnapshot: asNullableString(item.variantValueSnapshot),
    linkingAttributesSnapshot: mapLinkingAttributes(item.linkingAttributesSnapshot),
    quantity: parseCount(item.quantity),
    unitPriceMinor: parseMoney(item.unitPriceMinor),
    lineTotalMinor: parseMoney(item.lineTotalMinor),
  };
}

function mapDelivery(raw: unknown): OrderDelivery {
  const delivery = isRecord(raw) ? raw : {};
  return {
    fullName: asString(delivery.fullName),
    phone: asString(delivery.phone),
    address: asString(delivery.address),
  };
}

function mapContact(raw: unknown): OrderContact {
  const contact = isRecord(raw) ? raw : {};
  return {
    supportHandle: asNullableString(contact.supportHandle),
    telegramUsername: asNullableString(contact.telegramUsername),
  };
}

/** `null` — заказ не найден / недоступен (единый безопасный not-found). */
export function mapOrderDetails(raw: unknown): OrderDetails | null {
  if (!isRecord(raw)) return null;
  const currencyCode = asString(raw.currencyCode);
  return {
    id: asString(raw.id),
    publicOrderNumber: asString(raw.publicOrderNumber),
    status: asStatus(raw.status),
    deliveryOutcome: asDeliveryOutcome(raw.deliveryOutcome),
    refusalReasonCode: asRefusalReasonCode(raw.refusalReasonCode),
    currencyCode,
    currencySymbol: asSymbol(raw.currencySymbol, currencyCode),
    subtotalMinor: parseMoney(raw.subtotalMinor),
    totalMinor: parseMoney(raw.totalMinor),
    createdAt: asString(raw.createdAt),
    updatedAt: asString(raw.updatedAt),
    cancelledAt: asNullableString(raw.cancelledAt),
    completedAt: asNullableString(raw.completedAt),
    refusedAt: asNullableString(raw.refusedAt),
    delivery: mapDelivery(raw.delivery),
    contact: mapContact(raw.contact),
    items: asArray(raw.items).map(mapOrderItemView),
  };
}

import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../../domain/models/order';
import type {
  OrderContact,
  OrderDelivery,
  OrderDetails,
  OrderItemView,
  OrderListPage,
  OrderListItem,
  OrderPreviewItem,
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

function asStatus(value: unknown): OrderStatus {
  return asString(value) as OrderStatus;
}

function asNullableEnum<T extends string>(value: unknown): T | null {
  const s = asNullableString(value);
  return s === null ? null : (s as T);
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
  return {
    id: asString(item.id),
    publicOrderNumber: asString(item.publicOrderNumber),
    status: asStatus(item.status),
    createdAt: asString(item.createdAt),
    totalMinor: parseMoney(item.totalMinor),
    currencyCode: asString(item.currencyCode),
    currencySymbol: asString(item.currencySymbol),
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
  return {
    id: asString(raw.id),
    publicOrderNumber: asString(raw.publicOrderNumber),
    status: asStatus(raw.status),
    deliveryOutcome: asNullableEnum<DeliveryOutcome>(raw.deliveryOutcome),
    refusalReasonCode: asNullableEnum<RefusalReasonCode>(raw.refusalReasonCode),
    currencyCode: asString(raw.currencyCode),
    currencySymbol: asString(raw.currencySymbol),
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

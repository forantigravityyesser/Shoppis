import { mapStore } from './storefront-mappers';
import type { CartItemProjection, CartReadResult } from '../read-models/cart';

/**
 * Нормализует ответ `storefront_cart_items_read` (jsonb) в `CartReadResult`.
 *
 * Строгость как у остальных commerce-проекций (docs/14 PD-H-09): деньги/количества —
 * конечные неотрицательные числа, иначе null/0, а не «ложный ноль». Невалидная
 * ссылка остаётся в списке с `productAvailable=false`/`variantAvailable=false` —
 * решение «удалить из корзины» принимает реконсиляция (docs/18 §10), а не маппер.
 *
 * `null` — магазин не разрешён (unknown `public_id`); вызывающий слой в этом случае
 * реконсиляцию не применяет.
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

/** Деньги в minor units: неотрицательное конечное число или null. */
function parseMoney(value: unknown): number | null {
  const n = parseNumber(value);
  return n !== null && n >= 0 ? n : null;
}

/** Количество: неотрицательное конечное число или null. */
function parseCount(value: unknown): number | null {
  const n = parseNumber(value);
  return n !== null && n >= 0 ? n : null;
}

function mapItem(raw: unknown): CartItemProjection | null {
  if (!isRecord(raw)) return null;
  const productId = asString(raw.productId);
  if (!productId) return null;
  return {
    productId,
    variantId: asNullableString(raw.variantId),
    productAvailable: raw.productAvailable === true,
    variantAvailable: raw.variantAvailable === true,
    title: asString(raw.title),
    imageUrl: asNullableString(raw.imageUrl),
    variantName: asNullableString(raw.variantName),
    variantValue: asNullableString(raw.variantValue),
    unitPrice: parseMoney(raw.unitPrice),
    availableQuantity: parseCount(raw.availableQuantity) ?? 0,
  };
}

export function mapStorefrontCartItems(raw: unknown): CartReadResult | null {
  if (!isRecord(raw)) return null;
  const store = mapStore(raw.store);
  if (!store) return null;

  const items = Array.isArray(raw.items)
    ? raw.items.map(mapItem).filter((item): item is CartItemProjection => item !== null)
    : [];

  return { store, items };
}

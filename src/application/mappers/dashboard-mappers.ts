import type { SellerDashboardSummary } from '../read-models/seller-dashboard';

/**
 * Нормализует ответ edge `seller-dashboard` (проекция `seller_dashboard_read`) в
 * `SellerDashboardSummary` (docs/25 §3.2). Строгость как у остальных commerce-проекций:
 * типобезопасный доступ к `unknown`, счётчики/деньги — конечные неотрицательные числа
 * (иначе 0). `null` — сводка недоступна/битая проекция (не ошибка сети).
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Неотрицательное конечное число или 0. */
function parseCount(value: unknown): number {
  const n = parseNumber(value);
  return n !== null && n >= 0 ? n : 0;
}

/** `null` — нет валидного объекта сводки (чужой/несуществующий магазин). */
export function mapSellerDashboardSummary(raw: unknown): SellerDashboardSummary | null {
  if (!isRecord(raw)) return null;
  const orders = isRecord(raw.orders) ? raw.orders : {};
  const sales = isRecord(raw.sales) ? raw.sales : {};
  const inventory = isRecord(raw.inventory) ? raw.inventory : {};
  return {
    orders: {
      new: parseCount(orders.new),
      inTransit: parseCount(orders.inTransit),
      delivered: parseCount(orders.delivered),
      history: parseCount(orders.history),
    },
    sales: {
      receivedMinor: parseCount(sales.receivedMinor),
      frozenMinor: parseCount(sales.frozenMinor),
    },
    inventory: {
      activeProducts: parseCount(inventory.activeProducts),
      archivedProducts: parseCount(inventory.archivedProducts),
      activeCategories: parseCount(inventory.activeCategories),
    },
  };
}

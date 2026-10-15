/**
 * Сводка главной продавца (docs/25 §3.2) — read model ответа edge `seller-dashboard`
 * (RPC `seller_dashboard_read`). Все значения уже посчитаны сервером.
 */

/** Количество заказов по бакетам-зеркалам табов «Заказы» (docs/25 §1.1). */
export interface SellerDashboardOrderCounts {
  new: number;
  inTransit: number;
  delivered: number;
  history: number;
}

/** Доход в текущей валюте магазина (docs/25 §1.2/§3.5), в minor units. */
export interface SellerDashboardSales {
  /** Реализовано: заказы с исходом вручения `RECEIVED`. */
  receivedMinor: number;
  /** Заморожено: `IN_TRANSIT` или `DELIVERED` без зафиксированного исхода. */
  frozenMinor: number;
}

/** Счётчики инвентаря (docs/25 §1.3). */
export interface SellerDashboardInventory {
  activeProducts: number;
  archivedProducts: number;
  activeCategories: number;
  /** Товары `ACTIVE` с `ACTIVE`-вариантом и остатком > 0 (семантика витрины). docs/26 §3.4 */
  buyerAvailableProducts: number;
}

/** Факты развития магазина из реальных заказов (docs/26 §3.5). */
export interface SellerDashboardGrowth {
  firstOrderAt: string | null;
  firstShippedAt: string | null;
  firstCompletedAt: string | null;
}

export interface SellerDashboardSummary {
  orders: SellerDashboardOrderCounts;
  sales: SellerDashboardSales;
  inventory: SellerDashboardInventory;
  growth: SellerDashboardGrowth;
}

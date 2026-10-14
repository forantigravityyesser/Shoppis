import type { SellerDashboardSummary } from '../read-models/seller-dashboard';

/** Query-only порт сводки главной продавца (docs/25 §3.1). Записей здесь нет. */
export interface SellerDashboardQuery {
  sessionToken: string;
  /** Opaque storefront reference (public_id; legacy internal id резолвится сервером). */
  storeRef: string;
}

export interface SellerDashboardRepository {
  /** `null` — сводка недоступна (чужой/несуществующий магазин), не ошибка сети. */
  getSummary(query: SellerDashboardQuery): Promise<SellerDashboardSummary | null>;
}

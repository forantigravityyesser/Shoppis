import { requestSellerDashboard } from '../functions/dashboard-api';
import { mapSellerDashboardSummary } from '../../application/mappers/dashboard-mappers';
import type {
  SellerDashboardQuery,
  SellerDashboardRepository,
} from '../../application/ports/seller-dashboard-repository';
import type { SellerDashboardSummary } from '../../application/read-models/seller-dashboard';

/**
 * Seller Dashboard read repository (query-only, docs/25 §3.1).
 *
 * Читает через edge `seller-dashboard`: actor identity — из подписанной сессии,
 * авторизация — в SQL (`seller_dashboard_read`); `null` при чужом/несуществующем
 * магазине. Сырая проекция нормализуется application-маппером.
 */
export const getSummary: SellerDashboardRepository['getSummary'] = async (
  query: SellerDashboardQuery,
): Promise<SellerDashboardSummary | null> => {
  const raw = await requestSellerDashboard(query.sessionToken, query.storeRef);
  return mapSellerDashboardSummary(raw);
};

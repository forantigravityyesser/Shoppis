import { invokeFunction } from '../insforge/functions-gateway';

interface DashboardResponse {
  success?: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Сводка главной продавца из edge `seller-dashboard` (docs/25 SDB-02).
 * Сырая проекция; нормализуется application-маппером.
 */
export async function requestSellerDashboard(
  sessionToken: string,
  storeRef: string,
): Promise<unknown> {
  const { data, error } = await invokeFunction<DashboardResponse>('seller-dashboard', {
    body: { storeRef },
    token: sessionToken,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Dashboard query failed');
  return data.result ?? null;
}

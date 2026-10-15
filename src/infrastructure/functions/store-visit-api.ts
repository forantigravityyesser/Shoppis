import { invokeFunction } from '../insforge/functions-gateway';
import type { VisitedStore } from '../../application/ports/apis';

interface StoreVisitResponse {
  success?: boolean;
  store?: { publicId: string; name: string };
  error?: string;
}

interface BuyerStoresResponse {
  success?: boolean;
  stores?: VisitedStore[];
  error?: string;
}

/**
 * Фиксация открытия витрины покупателем (edge store-visit).
 * Вызывается из инициализации приложения после серверной аутентификации;
 * actor берётся из сессии, клиент передаёт только ссылку на витрину.
 */
export async function recordStoreVisit(token: string, storeRef: string): Promise<void> {
  const { data, error } = await invokeFunction<StoreVisitResponse>('store-visit', {
    body: { storeRef },
    token,
  });
  if (error) throw new Error(error.message);
  if (data?.success === false) throw new Error(data.error ?? 'Store visit failed');
}

/**
 * Посещённые витрины покупателя (edge buyer-stores, свежие первыми).
 * Fallback входа без deep-link: главный Mini App бота покупателя не передаёт
 * `startapp`, а localStorage WebView не делится между точками входа.
 */
export async function loadVisitedStores(token: string): Promise<VisitedStore[]> {
  const { data, error } = await invokeFunction<BuyerStoresResponse>('buyer-stores', {
    body: {},
    token,
  });
  if (error) throw new Error(error.message);
  if (data?.success === false) throw new Error(data.error ?? 'Store list failed');
  return Array.isArray(data?.stores) ? data.stores : [];
}

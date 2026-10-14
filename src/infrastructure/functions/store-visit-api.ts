import { invokeFunction } from '../insforge/functions-gateway';

interface StoreVisitResponse {
  success?: boolean;
  store?: { publicId: string; name: string };
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

import { invokeFunction } from '../insforge/functions-gateway';
import type { Store } from '../../domain/models/store';

export interface CreateShopPayload {
  name: string;
  currency: string;
  language: string;
  bannerUrl?: string;
}

interface CreateShopResponse {
  success?: boolean;
  store?: Store;
  error?: string;
}

/**
 * Создание магазина через edge-функцию shop-create.
 * owner_user_id проставляет сервер по валидной сессии; клиентский telegram id не передаётся.
 */
export async function createShopViaApi(token: string, payload: CreateShopPayload): Promise<Store> {
  const { data, error } = await invokeFunction<CreateShopResponse>('shop-create', {
    body: payload,
    token,
  });
  if (error) throw new Error(error.message);
  if (!data?.success || !data.store) throw new Error(data?.error ?? 'Store creation failed');
  return data.store;
}

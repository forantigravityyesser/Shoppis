import { insforge } from '../insforge/client';
import type { Store } from '../../domain/models/store';

export interface CreateShopPayload {
  name: string;
  currency: string;
  language: string;
  bannerUrl?: string;
}

type InvokeOptions = { body?: unknown; headers?: Record<string, string> };

/**
 * Создание магазина через edge-функцию shop-create.
 * owner_user_id проставляет сервер по валидной сессии; клиентский telegram id не передаётся.
 */
export async function createShopViaApi(token: string, payload: CreateShopPayload): Promise<Store> {
  const { data, error } = await (insforge.functions.invoke as unknown as (
    name: string,
    options?: InvokeOptions,
  ) => Promise<{ data: unknown; error: unknown }>)('shop-create', {
    body: payload,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw error;
  const res = data as { success?: boolean; store?: Store; error?: string } | null;
  if (!res?.success || !res.store) throw new Error(res?.error ?? 'Store creation failed');
  return res.store;
}

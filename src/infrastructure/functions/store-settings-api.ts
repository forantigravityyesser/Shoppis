import { invokeFunction } from '../insforge/functions-gateway';
import { DEV_AUTH_MODE } from '../insforge/config';
import { mapStore, type StoreRow } from '../repositories/store-repository';
import { updateStoreProfileDev, updateStoreStatusDev } from './store-settings-api.dev';
import type { Store, StoreStatus } from '../../domain/models/store';
import type { StoreProfilePatch } from '../../application/contracts/store';

/**
 * Клиент edge-диспетчера store-actions. Мутации настроек уходят на сервер, где
 * атомарно выполняются PL/pgSQL-функциями (migrations/0012) с проверкой владения
 * магазином по actor из сессии. Без сессии (dev mock) — локальный fallback.
 */
interface StoreActionResponse {
  success?: boolean;
  store?: StoreRow;
  error?: string;
}

function toProfilePayload(patch: StoreProfilePatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.bannerUrl !== undefined) payload.banner_url = patch.bannerUrl;
  if (patch.currency !== undefined) payload.currency = patch.currency;
  if (patch.language !== undefined) payload.language = patch.language;
  if (patch.supportHandle !== undefined) payload.support_handle = patch.supportHandle;
  return payload;
}

export async function updateProfile(
  token: string | null,
  storeId: string,
  patch: StoreProfilePatch,
): Promise<Store> {
  if (!token) {
    if (!DEV_AUTH_MODE) throw new Error('Unauthorized');
    return updateStoreProfileDev(storeId, patch);
  }

  const { data, error } = await invokeFunction<StoreActionResponse>('store-actions', {
    body: { action: 'update-profile', storeId, patch: toProfilePayload(patch) },
    token,
  });
  if (error) throw new Error(error.message);
  if (!data?.success || !data.store) throw new Error(data?.error ?? 'Store update failed');
  return mapStore(data.store);
}

export async function updateStatus(
  token: string | null,
  storeId: string,
  status: StoreStatus,
): Promise<Store> {
  if (!token) {
    if (!DEV_AUTH_MODE) throw new Error('Unauthorized');
    return updateStoreStatusDev(storeId, status);
  }

  const { data, error } = await invokeFunction<StoreActionResponse>('store-actions', {
    body: { action: 'update-status', storeId, status },
    token,
  });
  if (error) throw new Error(error.message);
  if (!data?.success || !data.store) throw new Error(data?.error ?? 'Store status update failed');
  return mapStore(data.store);
}

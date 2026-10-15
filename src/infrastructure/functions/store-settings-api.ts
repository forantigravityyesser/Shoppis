import { invokeFunction } from '../insforge/functions-gateway';
import { DEV_AUTH_MODE } from '../insforge/config';
import { mapStore, type StoreRow } from '../repositories/store-repository';
import {
  readStoreDev,
  updateStoreProfileDev,
  updateStoreStatusDev,
  updateStoreTutorialStateDev,
} from './store-settings-api.dev';
import type { Store, StoreStatus } from '../../domain/models/store';
import type { StoreProfilePatch, TutorialStatePatch } from '../../application/contracts/store';

/**
 * Клиент edge-диспетчера store-actions. Чтение и мутации настроек уходят на
 * сервер, где выполняются PL/pgSQL-функциями с проверкой владения магазином по
 * actor из сессии (`store_read_owned` / atomic-мутации). Без сессии (dev mock) —
 * локальный fallback.
 */
interface StoreActionResponse {
  success?: boolean;
  store?: StoreRow | null;
  error?: string;
}

/**
 * Owner-scoped чтение магазина (R1). Возвращает узкую проекцию из сервера; чужой/
 * несуществующий магазин → `null` (не ошибка). Без сессии — DEV-путь по id.
 */
export async function readStore(
  token: string | null,
  storeRef: string,
): Promise<Store | null> {
  if (!token) {
    if (!DEV_AUTH_MODE) throw new Error('Unauthorized');
    return readStoreDev(storeRef);
  }

  const { data, error } = await invokeFunction<StoreActionResponse>('store-actions', {
    body: { action: 'read', storeRef },
    token,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Store read failed');
  return data.store ? mapStore(data.store) : null;
}

function toProfilePayload(patch: StoreProfilePatch): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.bannerUrl !== undefined) payload.banner_url = patch.bannerUrl;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.currency !== undefined) payload.currency = patch.currency;
  if (patch.language !== undefined) payload.language = patch.language;
  if (patch.supportHandle !== undefined) payload.support_handle = patch.supportHandle;
  return payload;
}

function toTutorialPayload(patch: TutorialStatePatch): Record<string, unknown> {
  return {
    welcome_decision: patch.welcomeDecision,
    status: patch.status,
    step: patch.step,
  };
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

/** Запись состояния обучения (docs/26 §3.6); без сессии — только DEV-путь. */
export async function updateTutorialState(
  token: string | null,
  storeId: string,
  patch: TutorialStatePatch,
): Promise<Store> {
  if (!token) {
    if (!DEV_AUTH_MODE) throw new Error('Unauthorized');
    return updateStoreTutorialStateDev(storeId, patch);
  }

  const { data, error } = await invokeFunction<StoreActionResponse>('store-actions', {
    body: { action: 'tutorial-state', storeId, patch: toTutorialPayload(patch) },
    token,
  });
  if (error) throw new Error(error.message);
  if (!data?.success || !data.store) throw new Error(data?.error ?? 'Store tutorial update failed');
  return mapStore(data.store);
}

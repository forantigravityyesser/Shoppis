import { insforge } from '../insforge/client';
import { mapStore, type StoreRow } from '../repositories/store-repository';
import { currencySymbol } from '../../domain/constants/currencies';
import {
  isValidCurrency,
  isValidLanguage,
  isValidStatus,
  normalizeStoreName,
  validateStoreName,
} from '../../domain/rules/store-settings-rules';
import type { Store, StoreStatus } from '../../domain/models/store';
import type { StoreProfilePatch } from '../../application/contracts/store';

/**
 * DEV-ONLY путь обновления профиля: прямой SDK-update без серверной сессии.
 * Используется только при `DEV_AUTH_MODE` (браузер вне Telegram). Валидация
 * повторяет серверную, чтобы локальное поведение совпадало с production.
 */
export async function updateStoreProfileDev(
  storeId: string,
  patch: StoreProfilePatch,
): Promise<Store> {
  const values: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const name = normalizeStoreName(patch.name);
    if (validateStoreName(name)) throw new Error('NAME_REQUIRED');
    values.name = name;
  }
  if (patch.bannerUrl !== undefined) values.banner_url = patch.bannerUrl;
  if (patch.currency !== undefined) {
    if (!isValidCurrency(patch.currency)) throw new Error('INVALID_CURRENCY');
    values.currency = patch.currency;
    values.currency_symbol = currencySymbol(patch.currency);
  }
  if (patch.language !== undefined) {
    if (!isValidLanguage(patch.language)) throw new Error('INVALID_LANGUAGE');
    values.language = patch.language;
  }
  if (patch.supportHandle !== undefined) values.support_handle = patch.supportHandle;

  if (!Object.keys(values).length) throw new Error('EMPTY_PATCH');

  const { data, error } = await insforge.database
    .from('stores')
    .update(values)
    .eq('id', storeId)
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as StoreRow | undefined;
  if (!row) throw new Error('Store update returned no data');
  return mapStore(row);
}

/** DEV-ONLY смена статуса: прямой SDK-update без серверной сессии. */
export async function updateStoreStatusDev(storeId: string, status: StoreStatus): Promise<Store> {
  if (!isValidStatus(status)) throw new Error('INVALID_STATUS');

  const { data, error } = await insforge.database
    .from('stores')
    .update({ status })
    .eq('id', storeId)
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as StoreRow | undefined;
  if (!row) throw new Error('Store update returned no data');
  return mapStore(row);
}

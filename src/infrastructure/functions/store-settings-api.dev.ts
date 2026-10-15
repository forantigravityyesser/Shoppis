import { insforge } from '../insforge/client';
import { fetchStore, mapStore, type StoreRow } from '../repositories/store-repository';
import { currencySymbol } from '../../domain/constants/currencies';
import {
  isValidCurrency,
  isValidLanguage,
  isValidStatus,
  normalizeStoreDescription,
  normalizeStoreName,
  validateStoreDescription,
  validateStoreName,
} from '../../domain/rules/store-settings-rules';
import {
  isTutorialStatus,
  isTutorialStepKey,
  isTutorialWelcomeDecision,
} from '../../domain/rules/tutorial-rules';
import type { Store, StoreStatus } from '../../domain/models/store';
import type { StoreProfilePatch, TutorialStatePatch } from '../../application/contracts/store';

/**
 * DEV-ONLY чтение магазина без серверной сессии: прямой SDK-read по internal id
 * (в DEV нет подписанной сессии/owner-check). Только `DEV_AUTH_MODE`.
 */
export async function readStoreDev(storeRef: string): Promise<Store | null> {
  return fetchStore(storeRef);
}

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
  if (patch.description !== undefined) {
    const description = normalizeStoreDescription(patch.description);
    if (validateStoreDescription(description)) throw new Error('DESCRIPTION_TOO_LONG');
    values.description = description;
  }
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

/**
 * DEV-ONLY запись состояния обучения. Валидация зеркалит серверную (значения enum +
 * инвариант status↔step), чтобы локальное поведение совпадало с production.
 */
export async function updateStoreTutorialStateDev(
  storeId: string,
  patch: TutorialStatePatch,
): Promise<Store> {
  const invalid = (): never => {
    throw new Error('INVALID_TUTORIAL_STATE');
  };

  if (!isTutorialWelcomeDecision(patch.welcomeDecision)) invalid();
  if (!isTutorialStatus(patch.status)) invalid();
  if (patch.step !== null && !isTutorialStepKey(patch.step)) invalid();
  if ((patch.status === 'in_progress') !== (patch.step !== null)) invalid();

  const { data, error } = await insforge.database
    .from('stores')
    .update({
      tutorial_welcome_decision: patch.welcomeDecision,
      tutorial_status: patch.status,
      tutorial_step: patch.step,
      tutorial_updated_at: new Date().toISOString(),
    })
    .eq('id', storeId)
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as StoreRow | undefined;
  if (!row) throw new Error('Store tutorial update returned no data');
  return mapStore(row);
}

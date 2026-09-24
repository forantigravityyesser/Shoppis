import { insforge } from '../insforge/client';
import { mapStore, type StoreRow } from './store-repository';
import type { Store } from '../../domain/models/store';

/**
 * DEV-ONLY доступ к магазинам по telegram id.
 *
 * Используется только при отсутствии серверной сессии (DEV_AUTH_MODE, локальная
 * разработка вне Telegram). Production-путь ищет по owner_user_id.
 */
export async function fetchStoresByOwnerTelegram(ownerTelegramId: string): Promise<Store[]> {
  if (!ownerTelegramId) return [];
  const { data, error } = await insforge.database
    .from('stores')
    .select('*')
    .eq('owner_telegram_id', ownerTelegramId);
  if (error) throw error;
  return ((data ?? []) as StoreRow[]).map(mapStore);
}

export async function checkOwnershipByTelegram(storeId: string, ownerTelegramId: string): Promise<boolean> {
  if (!storeId || !ownerTelegramId) return false;
  const { data, error } = await insforge.database
    .from('stores')
    .select('id, owner_telegram_id')
    .eq('id', storeId)
    .maybeSingle();
  if (error || !data) return false;
  return (data as Pick<StoreRow, 'id'> & { owner_telegram_id: string | null }).owner_telegram_id === ownerTelegramId;
}

import { insforge } from '../insforge/client';
import type { LoyaltyLevel, StoreSettings } from '../../domain/models/store';

function mapSettings(loyaltyLevels: unknown): StoreSettings {
  return {
    loyaltyLevels: Array.isArray(loyaltyLevels) ? (loyaltyLevels as LoyaltyLevel[]) : [],
  };
}

export async function fetchStoreSettings(storeId: string): Promise<StoreSettings> {
  const { data, error } = await insforge.database
    .from('stores')
    .select('loyalty_levels')
    .eq('id', storeId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { loyalty_levels: unknown } | null;
  return mapSettings(row?.loyalty_levels);
}

export async function updateStoreSettings(
  storeId: string,
  settings: StoreSettings,
): Promise<StoreSettings> {
  const { data, error } = await insforge.database
    .from('stores')
    .update({ loyalty_levels: settings.loyaltyLevels })
    .eq('id', storeId)
    .select('loyalty_levels');
  if (error) throw error;
  const row = (data ?? [])[0] as { loyalty_levels: unknown } | undefined;
  return mapSettings(row?.loyalty_levels);
}

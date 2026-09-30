import { insforge } from '../insforge/client';
import type { Store, StoreCurrency, StoreLanguage, StoreStatus } from '../../domain/models/store';
import type { CreateStoreInput } from '../../application/contracts/store';

const CURRENCY_SYMBOLS: Record<StoreCurrency, string> = {
  USD: '$',
  RUB: '₽',
  BYN: 'Br',
};

export interface StoreRow {
  id: string;
  owner_user_id: string | null;
  owner_telegram_id: string | null;
  name: string;
  description: string;
  logo_url: string;
  banner_url: string;
  support_handle: string;
  currency: string;
  currency_symbol: string;
  language: string;
  status: string | null;
  public_id: string | null;
  created_at: string;
}

export function mapStore(row: StoreRow): Store {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id ?? null,
    ownerTelegramId: row.owner_telegram_id ?? '',
    name: row.name,
    description: row.description ?? '',
    logoUrl: row.logo_url ?? '',
    bannerUrl: row.banner_url ?? '',
    supportHandle: row.support_handle ?? '',
    currencyCode: (row.currency as StoreCurrency) ?? 'USD',
    currencySymbol: row.currency_symbol ?? '$',
    language: (row.language as StoreLanguage) ?? 'ru',
    status: (row.status as StoreStatus) ?? 'ACTIVE',
    publicId: row.public_id ?? '',
    createdAt: row.created_at,
  };
}

export async function fetchStore(storeId: string): Promise<Store | null> {
  const { data, error } = await insforge.database
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .maybeSingle();
  if (error) throw error;
  const row = data as StoreRow | null;
  return row ? mapStore(row) : null;
}

/** Публичное чтение витрины по opaque public_id (без владения). */
export async function fetchStoreByPublicId(publicId: string): Promise<Store | null> {
  if (!publicId) return null;
  const { data, error } = await insforge.database
    .from('stores')
    .select('*')
    .eq('public_id', publicId)
    .maybeSingle();
  if (error) throw error;
  const row = data as StoreRow | null;
  return row ? mapStore(row) : null;
}

/** Витрины серверного User (authoritative identity), поиск по owner_user_id. */
export async function fetchStoresByOwnerUser(ownerUserId: string): Promise<Store[]> {
  const { data, error } = await insforge.database
    .from('stores')
    .select('*')
    .eq('owner_user_id', ownerUserId);
  if (error) throw error;
  return ((data ?? []) as StoreRow[]).map(mapStore);
}

/** Создание витрины из формы онбординга. Символ валюты выводится из кода. */
export async function createStore(input: CreateStoreInput): Promise<Store> {
  const { data, error } = await insforge.database
    .from('stores')
    .insert({
      owner_telegram_id: input.ownerTelegramId,
      name: input.name,
      description: input.description ?? '',
      banner_url: input.bannerUrl ?? '',
      currency: input.currency,
      currency_symbol: CURRENCY_SYMBOLS[input.currency],
      language: input.language,
    })
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as StoreRow | undefined;
  if (!row) throw new Error('Store insert returned no data');
  return mapStore(row);
}

export async function checkOwnershipByUser(storeId: string, userId: string): Promise<boolean> {
  const store = await fetchStore(storeId);
  return store?.ownerUserId === userId;
}

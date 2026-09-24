import { insforge } from '../insforge/client';
import type { Store, StoreCurrency, StoreLanguage } from '../../domain/models/store';

const CURRENCY_SYMBOLS: Record<StoreCurrency, string> = {
  USD: '$',
  RUB: '₽',
  BYN: 'Br',
};

interface StoreRow {
  id: string;
  owner_telegram_id: string;
  name: string;
  description: string;
  logo_url: string;
  banner_url: string;
  support_handle: string;
  currency: string;
  currency_symbol: string;
  language: string;
  created_at: string;
}

function mapStore(row: StoreRow): Store {
  return {
    id: row.id,
    ownerTelegramId: row.owner_telegram_id,
    name: row.name,
    description: row.description ?? '',
    logoUrl: row.logo_url ?? '',
    bannerUrl: row.banner_url ?? '',
    supportHandle: row.support_handle ?? '',
    currency: (row.currency as StoreCurrency) ?? 'USD',
    currencySymbol: row.currency_symbol ?? '$',
    language: (row.language as StoreLanguage) ?? 'ru',
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

export async function fetchStoresByOwner(ownerTelegramId: string): Promise<Store[]> {
  const { data, error } = await insforge.database
    .from('stores')
    .select('*')
    .eq('owner_telegram_id', ownerTelegramId);
  if (error) throw error;
  return ((data ?? []) as StoreRow[]).map(mapStore);
}

export interface CreateStoreInput {
  ownerTelegramId: string;
  name: string;
  currency: StoreCurrency;
  language: StoreLanguage;
  bannerUrl?: string;
  description?: string;
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

export async function checkOwnership(storeId: string, telegramId: string): Promise<boolean> {
  const store = await fetchStore(storeId);
  return store?.ownerTelegramId === telegramId;
}

/** Порт storeApi.checkStoreOwnership/verifyStore: чей магазин / существует ли витрина */
export async function checkStoreOwnership(telegramId: string): Promise<string | null> {
  if (!telegramId) return null;
  const { data, error } = await insforge.database
    .from('stores')
    .select('id')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function verifyStore(id: string): Promise<boolean> {
  if (!id) return false;
  const { data, error } = await insforge.database.from('stores').select('id').eq('id', id).maybeSingle();
  return !!(data && !error);
}

export interface StoreProfilePatch {
  name?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  supportHandle?: string;
  currency?: StoreCurrency;
  currencySymbol?: string;
  language?: StoreLanguage;
}

export async function updateStoreProfile(id: string, patch: StoreProfilePatch): Promise<Store> {
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.logoUrl !== undefined) values.logo_url = patch.logoUrl;
  if (patch.supportHandle !== undefined) values.support_handle = patch.supportHandle;
  if (patch.currency !== undefined) values.currency = patch.currency;
  if (patch.currencySymbol !== undefined) values.currency_symbol = patch.currencySymbol;
  if (patch.bannerUrl !== undefined) values.banner_url = patch.bannerUrl;
  if (patch.language !== undefined) values.language = patch.language;

  const { data, error } = await insforge.database
    .from('stores')
    .update(values)
    .eq('id', id)
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as StoreRow | undefined;
  if (!row) throw new Error('Store update returned no data');
  return mapStore(row);
}

import { insforge } from '../insforge/client';
import type { Customer } from '../../domain/models/customer';

interface CustomerRow {
  id: string;
  store_id: string;
  telegram_id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  total_spent: number;
  created_at: string;
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    storeId: row.store_id,
    telegramId: row.telegram_id,
    username: row.username ?? '',
    name: row.name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    totalSpent: Number(row.total_spent ?? 0),
    createdAt: row.created_at,
  };
}

export interface UpsertCustomerInput {
  storeId: string;
  telegramId: string;
  username: string;
  name: string;
  phone: string;
  email: string;
}

/** Привязка покупателя к витрине: одна строка на (store_id, telegram_id) */
export async function upsertCustomer(input: UpsertCustomerInput): Promise<Customer> {
  // Порт getOrCreateCustomer из старого проекта: атомарный upsert по конфликту.
  const { data, error } = await insforge.database
    .from('customers')
    .upsert(
      {
        store_id: input.storeId,
        telegram_id: input.telegramId,
        username: input.username,
        name: input.name,
        phone: input.phone,
        email: input.email,
      },
      { onConflict: 'store_id,telegram_id' },
    )
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as CustomerRow | undefined;
  if (!row) throw new Error('Customer upsert returned no data');
  return mapCustomer(row);
}

/** Совместимость: старый слой вызывал getOrCreateCustomer(storeId, telegramId, username, user) */
export async function getOrCreateCustomer(
  storeId: string,
  telegramId: string,
  username: string,
  name: string,
): Promise<Customer> {
  return upsertCustomer({ storeId, telegramId, username, name, phone: '', email: '' });
}

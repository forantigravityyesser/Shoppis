import { insforge } from '../insforge/client';
import type { Category, CategoryStatus } from '../../domain/models/category';

interface CategoryRow {
  id: string;
  store_id: string;
  name: string;
  normalized_name: string;
  sort_order: number;
  status: CategoryStatus;
  created_at: string;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    sortOrder: row.sort_order ?? 0,
    status: row.status,
    createdAt: row.created_at,
  };
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export async function fetchCategories(storeId: string): Promise<Category[]> {
  const { data, error } = await insforge.database
    .from('categories')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'ACTIVE')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CategoryRow[]).map(mapCategory);
}

export async function addCategory(storeId: string, name: string): Promise<Category> {
  const { data: maxData, error: maxError } = await insforge.database
    .from('categories')
    .select('sort_order')
    .eq('store_id', storeId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (maxError) throw maxError;
  const maxIndex = (maxData ?? [])[0] as { sort_order: number } | undefined;

  const { data, error } = await insforge.database
    .from('categories')
    .insert({
      store_id: storeId,
      name: name.trim(),
      normalized_name: normalize(name),
      sort_order: (maxIndex?.sort_order ?? -1) + 1,
      status: 'ACTIVE',
    })
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as CategoryRow | undefined;
  if (!row) throw new Error('Category insert returned no data');
  return mapCategory(row);
}

/** Архив категории: товары сохраняют привязку, категория скрывается. 02 §13 */
export async function setCategoryStatus(id: string, status: CategoryStatus): Promise<void> {
  const { error } = await insforge.database.from('categories').update({ status }).eq('id', id);
  if (error) throw error;
}

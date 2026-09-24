import { insforge } from '../insforge/client';
import type { Category } from '../../domain/models/category';

interface CategoryRow {
  id: string;
  store_id: string;
  name: string;
  order_index: number;
  created_at: string;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    orderIndex: row.order_index ?? 0,
    createdAt: row.created_at,
  };
}

export async function fetchCategories(storeId: string): Promise<Category[]> {
  const { data, error } = await insforge.database
    .from('categories')
    .select('*')
    .eq('store_id', storeId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CategoryRow[]).map(mapCategory);
}

export async function addCategory(storeId: string, name: string): Promise<Category> {
  const { data: maxData, error: maxError } = await insforge.database
    .from('categories')
    .select('order_index')
    .eq('store_id', storeId)
    .order('order_index', { ascending: false })
    .limit(1);
  if (maxError) throw maxError;
  const maxIndex = (maxData ?? [])[0] as { order_index: number } | undefined;

  const { data, error } = await insforge.database
    .from('categories')
    .insert({
      store_id: storeId,
      name,
      order_index: (maxIndex?.order_index ?? -1) + 1,
    })
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as CategoryRow | undefined;
  if (!row) throw new Error('Category insert returned no data');
  return mapCategory(row);
}

export async function removeCategory(id: string): Promise<void> {
  const { error } = await insforge.database.from('categories').delete().eq('id', id);
  if (error) throw error;
}

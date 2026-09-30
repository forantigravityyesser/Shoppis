import { insforge } from '../insforge/client';
import type { Category, CategoryStatus } from '../../domain/models/category';
import type { AddCategoryInput, UpdateCategoryPatch } from '../../application/contracts/category';
import { deleteCategory as deleteCategoryViaApi } from '../functions/catalog-api';

interface CategoryRow {
  id: string;
  store_id: string;
  name: string;
  normalized_name: string;
  sort_order: number;
  status: CategoryStatus;
  created_at: string;
  image_storage_key: string | null;
  low_stock_threshold: number | null;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    sortOrder: row.sort_order ?? 0,
    status: row.status,
    createdAt: row.created_at,
    imageStorageKey: row.image_storage_key ?? null,
    lowStockThreshold: row.low_stock_threshold ?? null,
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

export async function addCategory(storeId: string, input: AddCategoryInput): Promise<Category> {
  const name = input.name.trim();
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
      name,
      normalized_name: normalize(name),
      sort_order: (maxIndex?.sort_order ?? -1) + 1,
      status: 'ACTIVE',
      image_storage_key: input.imageStorageKey ?? null,
      low_stock_threshold: input.lowStockThreshold ?? null,
    })
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as CategoryRow | undefined;
  if (!row) throw new Error('Category insert returned no data');
  return mapCategory(row);
}

export async function updateCategory(id: string, patch: UpdateCategoryPatch): Promise<void> {
  const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    values.name = patch.name.trim();
    values.normalized_name = normalize(patch.name);
  }
  if (patch.imageStorageKey !== undefined) values.image_storage_key = patch.imageStorageKey;
  if (patch.lowStockThreshold !== undefined) values.low_stock_threshold = patch.lowStockThreshold;

  const { error } = await insforge.database.from('categories').update(values).eq('id', id);
  if (error) throw error;
}

/**
 * Удаление категории: товары не удаляются, а теряют привязку (`category_id = null`)
 * и попадают в «Без категории». 02 §. Обложку удаляет вызывающий слой (Storage).
 */
export async function deleteCategory(id: string, token: string | null): Promise<string | null> {
  if (token) {
    return deleteCategoryViaApi(token, id);
  }
  const { data, error: findError } = await insforge.database
    .from('categories')
    .select('image_storage_key')
    .eq('id', id)
    .maybeSingle();
  if (findError) throw findError;
  const imageKey =
    (data as { image_storage_key?: string | null } | null)?.image_storage_key ?? null;

  const { error: reassignError } = await insforge.database
    .from('products')
    .update({ category_id: null, updated_at: new Date().toISOString() })
    .eq('category_id', id);
  if (reassignError) throw reassignError;

  const { error } = await insforge.database.from('categories').delete().eq('id', id);
  if (error) throw error;

  return imageKey;
}

/** Архив категории: товары сохраняют привязку, категория скрывается. 02 §13 */
export async function setCategoryStatus(id: string, status: CategoryStatus): Promise<void> {
  const { error } = await insforge.database.from('categories').update({ status }).eq('id', id);
  if (error) throw error;
}

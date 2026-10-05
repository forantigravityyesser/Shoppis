import { UNCATEGORIZED_ID } from '../constants/categories';

/** Системная категория «Без категории»: её нельзя редактировать или удалить. */
export function isSystemCategory(categoryId: string | null | undefined): boolean {
  return categoryId === UNCATEGORIZED_ID;
}

/**
 * Локальная (оптимистичная) перестановка категорий. `position` — 1-based; итоговый
 * `sortOrder` пересчитывается в 0..N-1 (совпадает с серверным `category_reorder_atomic`).
 * Неизвестный `id` — возвращает исходный список. Системная «Без категории» хранится
 * отдельно и сюда не попадает.
 */
export function reorderCategories<T extends { id: string; sortOrder: number }>(
  list: T[],
  id: string,
  position: number,
): T[] {
  const ordered = list.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const from = ordered.findIndex((c) => c.id === id);
  if (from === -1) return list;
  const [moved] = ordered.splice(from, 1);
  const to = Math.min(Math.max(position - 1, 0), ordered.length);
  ordered.splice(to, 0, moved);
  return ordered.map((category, index) => ({ ...category, sortOrder: index }));
}

/**
 * Категория товара: если не задана или не найдена среди категорий магазина —
 * товар попадает в системную «Без категории».
 */
export function resolveProductCategoryId(
  categoryId: string | null,
  storeCategoryIds: string[],
): string {
  if (categoryId && storeCategoryIds.includes(categoryId)) return categoryId;
  return UNCATEGORIZED_ID;
}

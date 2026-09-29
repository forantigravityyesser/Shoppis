import { UNCATEGORIZED_ID } from '../constants/categories';

/** Системная категория «Без категории»: её нельзя редактировать или удалить. */
export function isSystemCategory(categoryId: string | null | undefined): boolean {
  return categoryId === UNCATEGORIZED_ID;
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

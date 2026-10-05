import { resolveProductCategoryId } from '../../domain/rules/category-rules';
import type { InventoryProductItem } from './inventory-view';

/**
 * id товаров, уже находящихся в категории (для мультивыбора «Товар из магазина»).
 * Товар без валидной пользовательской категории относится к системной «Без категории».
 * `categoryId = null` → пустой список (нет контекста категории).
 */
export function existingProductIdsForCategory(
  allProducts: InventoryProductItem[],
  userCategoryIds: string[],
  categoryId: string | null,
): string[] {
  if (!categoryId) return [];
  return allProducts
    .filter(
      (product) => resolveProductCategoryId(product.categoryId, userCategoryIds) === categoryId,
    )
    .map((product) => product.id);
}

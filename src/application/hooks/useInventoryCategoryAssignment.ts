import { useMemo } from 'react';
import type { InventoryProductItem } from '../read-models/inventory-view';
import { existingProductIdsForCategory } from '../read-models/inventory-assignment';

/**
 * id товаров, уже находящихся в целевой категории. Держит derived-логику назначения
 * вне `InventoryView` (docs/20 §8); данные приходят из `useInventoryHome`.
 */
export function useInventoryCategoryAssignment(
  allProducts: InventoryProductItem[],
  userCategoryIds: string[],
  categoryId: string | null,
): string[] {
  return useMemo(
    () => existingProductIdsForCategory(allProducts, userCategoryIds, categoryId),
    [allProducts, userCategoryIds, categoryId],
  );
}

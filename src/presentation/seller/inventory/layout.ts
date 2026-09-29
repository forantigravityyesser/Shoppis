import type { InventoryCategoryItem } from '../../../application/hooks/useInventory';

/** Визуальный ряд сетки категорий: одна широкая или пара компактных. */
export type CategoryRow =
  | { type: 'wide'; key: string; category: InventoryCategoryItem }
  | { type: 'pair'; key: string; items: InventoryCategoryItem[] };

/**
 * Сколько карточек товара видно одновременно в строке превью категории.
 * Остальные доступны свайпом/стрелками (mobile-first, без видимого скроллбара).
 */
export const PREVIEW_VISIBLE = { wide: 5, compact: 3 } as const;

/**
 * Детерминированная композиция Home: wide → pair → wide → pair …
 * Без masonry и без хранения layout в БД (спека §15).
 */
export function buildCategoryRows(categories: InventoryCategoryItem[]): CategoryRow[] {
  const rows: CategoryRow[] = [];
  let index = 0;
  let wide = true;

  while (index < categories.length) {
    if (wide || categories.length - index === 1) {
      const category = categories[index];
      rows.push({ type: 'wide', key: category.id, category });
      index += 1;
    } else {
      const items = categories.slice(index, index + 2);
      rows.push({ type: 'pair', key: items.map((c) => c.id).join(':'), items });
      index += 2;
    }
    wide = !wide;
  }

  return rows;
}

/** Русская форма множественного числа: pluralRu(2, ['товар','товара','товаров']). */
export function pluralRu(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

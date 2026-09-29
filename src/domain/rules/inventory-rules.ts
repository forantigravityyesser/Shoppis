import { DEFAULT_LOW_STOCK_THRESHOLD } from '../constants/limits';
import type { Category } from '../models/category';
import type { Inventory, Variant } from '../models/product';

/**
 * Состояние остатка товара для UI. `hidden` — товар не активен (в архиве). ADR-06.2.
 */
export type StockState = 'in_stock' | 'low_stock' | 'out_of_stock' | 'hidden';

/** Порог low_stock: категория → глобальный дефолт. ADR-06.6 */
export function lowStockThresholdFor(
  category?: Pick<Category, 'lowStockThreshold'> | null,
): number {
  return category?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
}

/** Активные варианты товара — только они участвуют в остатке. 03 §11, §24 */
export function activeVariantsOf(productId: string, variants: Variant[]): Variant[] {
  return variants.filter((v) => v.productId === productId && v.status === 'ACTIVE');
}

export interface ProductStock {
  available: number;
  held: number;
  variantCount: number;
}

/**
 * Агрегат остатка товара по его активным вариантам. Не хранится (ADR-06.2).
 * Компонент не должен сам складывать inventory — только вызывать это правило.
 */
export function productStock(
  productId: string,
  variants: Variant[],
  inventories: Inventory[],
): ProductStock {
  const ids = new Set(activeVariantsOf(productId, variants).map((v) => v.id));
  let available = 0;
  let held = 0;
  for (const row of inventories) {
    if (!ids.has(row.variantId)) continue;
    available += row.availableQuantity;
    held += row.heldQuantity;
  }
  return { available, held, variantCount: ids.size };
}

export function stockStateFor(available: number, threshold: number): StockState {
  if (available <= 0) return 'out_of_stock';
  if (available <= threshold) return 'low_stock';
  return 'in_stock';
}

import { describe, expect, it } from 'vitest';
import {
  activeVariantsOf,
  lowStockThresholdFor,
  productStock,
  stockStateFor,
} from './inventory-rules';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../constants/limits';
import type { Inventory, Variant } from '../models/product';

function makeVariant(overrides: Partial<Variant> = {}): Variant {
  return {
    id: 'v1',
    productId: 'p1',
    name: 'Объём',
    value: '1L',
    sortOrder: 0,
    status: 'ACTIVE',
    priceMode: 'USE_PRODUCT_PRICE',
    customOriginalAmountMinor: null,
    customDiscountPercent: null,
    ...overrides,
  };
}

function makeInventory(variantId: string, available: number, held = 0): Inventory {
  return { variantId, availableQuantity: available, heldQuantity: held };
}

describe('lowStockThresholdFor', () => {
  it('falls back to the global default', () => {
    expect(lowStockThresholdFor(null)).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    expect(lowStockThresholdFor(undefined)).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    expect(lowStockThresholdFor({ lowStockThreshold: null })).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
  });

  it('uses the category override', () => {
    expect(lowStockThresholdFor({ lowStockThreshold: 2 })).toBe(2);
  });
});

describe('activeVariantsOf', () => {
  it('keeps only active variants of the given product', () => {
    const variants = [
      makeVariant({ id: 'v1', productId: 'p1', status: 'ACTIVE' }),
      makeVariant({ id: 'v2', productId: 'p1', status: 'ARCHIVED' }),
      makeVariant({ id: 'v3', productId: 'p2', status: 'ACTIVE' }),
    ];
    expect(activeVariantsOf('p1', variants).map((v) => v.id)).toEqual(['v1']);
  });
});

describe('productStock', () => {
  it('aggregates only inventories of active variants', () => {
    const variants = [
      makeVariant({ id: 'v1', productId: 'p1', status: 'ACTIVE' }),
      makeVariant({ id: 'v2', productId: 'p1', status: 'ACTIVE' }),
      makeVariant({ id: 'v3', productId: 'p1', status: 'ARCHIVED' }),
    ];
    const inventories = [
      makeInventory('v1', 3, 1),
      makeInventory('v2', 4, 2),
      makeInventory('v3', 100, 100),
    ];
    expect(productStock('p1', variants, inventories)).toEqual({
      available: 7,
      held: 3,
      variantCount: 2,
    });
  });

  it('returns zeros when no active variants', () => {
    expect(productStock('p1', [], [makeInventory('v9', 5)])).toEqual({
      available: 0,
      held: 0,
      variantCount: 0,
    });
  });
});

describe('stockStateFor', () => {
  it('classifies stock against the threshold', () => {
    expect(stockStateFor(0, 5)).toBe('out_of_stock');
    expect(stockStateFor(-1, 5)).toBe('out_of_stock');
    expect(stockStateFor(5, 5)).toBe('low_stock');
    expect(stockStateFor(6, 5)).toBe('in_stock');
  });
});

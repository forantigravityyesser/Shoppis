import { describe, expect, it } from 'vitest';
import type { StoreReadinessInput } from '../models/tutorial';
import {
  READINESS_TOTAL,
  computeShopReadiness,
  hasStoreAppearance,
  hasValidSupportHandle,
} from './readiness-rules';

function input(overrides: Partial<StoreReadinessInput> = {}): StoreReadinessInput {
  return {
    storeName: 'Nike Shop',
    bannerUrl: '',
    description: '',
    supportHandle: '',
    buyerAvailableProducts: 0,
    activeCategories: 0,
    ...overrides,
  };
}

describe('hasStoreAppearance', () => {
  it('is complete when either banner or description is present (§8.1)', () => {
    expect(hasStoreAppearance('', '')).toBe(false);
    expect(hasStoreAppearance(' ', '  ')).toBe(false);
    expect(hasStoreAppearance('banner.jpg', '')).toBe(true);
    expect(hasStoreAppearance('', 'About us')).toBe(true);
    expect(hasStoreAppearance('banner.jpg', 'About us')).toBe(true);
  });
});

describe('hasValidSupportHandle', () => {
  it('accepts only a normalized valid username', () => {
    expect(hasValidSupportHandle('john')).toBe(true);
    expect(hasValidSupportHandle('@john')).toBe(true);
    expect(hasValidSupportHandle('t.me/john')).toBe(true);
    expect(hasValidSupportHandle('')).toBe(false);
    expect(hasValidSupportHandle('@')).toBe(false);
    expect(hasValidSupportHandle('1john')).toBe(false);
    expect(hasValidSupportHandle('john doe')).toBe(false);
  });
});

describe('computeShopReadiness', () => {
  it('progress counts all visible checklist steps (5)', () => {
    expect(computeShopReadiness(input()).progress.total).toBe(READINESS_TOTAL);
    expect(READINESS_TOTAL).toBe(5);
  });

  it('always reports the store name as completed and counts it as a step', () => {
    const readiness = computeShopReadiness(input());
    expect(readiness.storeName).toBe('completed');
    // Название — единственный выполненный пункт на пустом магазине.
    expect(readiness.progress).toEqual({ completed: 1, total: 5 });
  });

  it('appearance is a normal step: incomplete until banner or description', () => {
    expect(computeShopReadiness(input()).storeAppearance).toBe('incomplete');
    expect(computeShopReadiness(input({ bannerUrl: 'b.jpg' })).storeAppearance).toBe('completed');
    expect(computeShopReadiness(input({ description: 'About us' })).storeAppearance).toBe(
      'completed',
    );
  });

  it('counts an available product only at >= 1', () => {
    expect(computeShopReadiness(input({ buyerAvailableProducts: 0 })).availableProduct).toBe(
      'incomplete',
    );
    expect(computeShopReadiness(input({ buyerAvailableProducts: 1 })).availableProduct).toBe(
      'completed',
    );
  });

  it('counts a category only at >= 1', () => {
    expect(computeShopReadiness(input({ activeCategories: 0 })).category).toBe('incomplete');
    expect(computeShopReadiness(input({ activeCategories: 2 })).category).toBe('completed');
  });

  it('counts support links only when the handle is valid', () => {
    expect(computeShopReadiness(input({ supportHandle: ' ' })).supportLinks).toBe('incomplete');
    expect(computeShopReadiness(input({ supportHandle: '@john' })).supportLinks).toBe('completed');
  });

  it('is ready only when every step is completed', () => {
    expect(
      computeShopReadiness(
        input({
          bannerUrl: 'b.jpg',
          buyerAvailableProducts: 1,
          activeCategories: 1,
          supportHandle: 'john',
        }),
      ).preparationReady,
    ).toBe(true);
    // Без оформления магазин ещё не «подготовлен».
    expect(
      computeShopReadiness(
        input({ buyerAvailableProducts: 1, activeCategories: 1, supportHandle: 'john' }),
      ).preparationReady,
    ).toBe(false);
  });

  it('tracks progress across combinations', () => {
    expect(computeShopReadiness(input()).progress).toEqual({ completed: 1, total: 5 });
    expect(
      computeShopReadiness(
        input({ bannerUrl: 'b.jpg', activeCategories: 1, supportHandle: 'john' }),
      ).progress,
    ).toEqual({ completed: 4, total: 5 });
  });
});

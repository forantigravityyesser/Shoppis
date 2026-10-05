import { describe, expect, it } from 'vitest';
import {
  compareProductsForDisplay,
  currentPriceMinor,
  effectivePrice,
  formatMoneyMinor,
  isInStock,
  validateProduct,
} from './product-rules';
import type { Product, Variant } from '../models/product';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    storeId: 's1',
    productGroupId: null,
    categoryId: null,
    title: 'Товар',
    description: '',
    status: 'ACTIVE',
    sortOrder: 0,
    originalAmountMinor: 1000,
    discountPercent: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

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

describe('currentPriceMinor', () => {
  it('returns original when discount is 0', () => {
    expect(currentPriceMinor(1000, 0)).toBe(1000);
  });

  it('applies discount', () => {
    expect(currentPriceMinor(1000, 25)).toBe(750);
  });

  it('rounds to nearest minor unit', () => {
    expect(currentPriceMinor(999, 10)).toBe(899);
    expect(currentPriceMinor(1005, 50)).toBe(503);
  });
});

describe('effectivePrice — независимые оси (docs/20 §3.1)', () => {
  it('inherited/inherited: обе оси от товара', () => {
    const product = makeProduct({ originalAmountMinor: 2000, discountPercent: 10 });
    expect(effectivePrice(makeVariant(), product)).toEqual({
      originalAmountMinor: 2000,
      discountPercent: 10,
      currentAmountMinor: 1800,
    });
  });

  it('custom/custom: обе оси свои', () => {
    const variant = makeVariant({
      priceMode: 'CUSTOM_PRICE',
      customOriginalAmountMinor: 5000,
      customDiscountPercent: 20,
    });
    expect(effectivePrice(variant, makeProduct())).toEqual({
      originalAmountMinor: 5000,
      discountPercent: 20,
      currentAmountMinor: 4000,
    });
  });

  it('custom price / inherited discount: скидка берётся у товара', () => {
    const variant = makeVariant({
      priceMode: 'CUSTOM_PRICE',
      customOriginalAmountMinor: 5000,
      customDiscountPercent: null,
    });
    expect(effectivePrice(variant, makeProduct({ discountPercent: 10 }))).toEqual({
      originalAmountMinor: 5000,
      discountPercent: 10,
      currentAmountMinor: 4500,
    });
  });

  it('inherited price / custom discount: цена берётся у товара', () => {
    const variant = makeVariant({
      priceMode: 'CUSTOM_PRICE',
      customOriginalAmountMinor: null,
      customDiscountPercent: 25,
    });
    expect(effectivePrice(variant, makeProduct({ originalAmountMinor: 2000 }))).toEqual({
      originalAmountMinor: 2000,
      discountPercent: 25,
      currentAmountMinor: 1500,
    });
  });

  it('custom discount = 0 — валидный custom, а не наследование', () => {
    const variant = makeVariant({
      priceMode: 'CUSTOM_PRICE',
      customOriginalAmountMinor: 5000,
      customDiscountPercent: 0,
    });
    expect(effectivePrice(variant, makeProduct({ discountPercent: 30 }))).toEqual({
      originalAmountMinor: 5000,
      discountPercent: 0,
      currentAmountMinor: 5000,
    });
  });

  it('CUSTOM_PRICE без обоих custom-значений откатывается к товару', () => {
    const variant = makeVariant({
      priceMode: 'CUSTOM_PRICE',
      customOriginalAmountMinor: null,
      customDiscountPercent: null,
    });
    expect(
      effectivePrice(variant, makeProduct({ originalAmountMinor: 1000, discountPercent: 10 }))
        .currentAmountMinor,
    ).toBe(900);
  });
});

describe('validateProduct', () => {
  it('accepts a valid product', () => {
    expect(
      validateProduct({ title: 'A', originalAmountMinor: 100, discountPercent: 0, imageCount: 1 }),
    ).toEqual([]);
  });

  it('requires a title', () => {
    expect(
      validateProduct({
        title: '   ',
        originalAmountMinor: 100,
        discountPercent: 0,
        imageCount: 0,
      }),
    ).toContain('Название товара обязательно');
  });

  it('requires a positive price', () => {
    expect(
      validateProduct({ title: 'A', originalAmountMinor: 0, discountPercent: 0, imageCount: 0 }),
    ).toContain('Цена должна быть больше нуля');
  });

  it('allows zero price when archiving without variants', () => {
    expect(
      validateProduct({
        title: 'A',
        originalAmountMinor: 0,
        discountPercent: 0,
        imageCount: 0,
        status: 'ARCHIVED',
      }),
    ).toEqual([]);
  });

  it('validates discount range', () => {
    expect(
      validateProduct({ title: 'A', originalAmountMinor: 1, discountPercent: 101, imageCount: 0 }),
    ).toContain('Скидка должна быть от 0 до 100%');
    expect(
      validateProduct({ title: 'A', originalAmountMinor: 1, discountPercent: -1, imageCount: 0 }),
    ).toContain('Скидка должна быть от 0 до 100%');
  });

  it('validates image count against MAX_IMAGES', () => {
    expect(
      validateProduct({ title: 'A', originalAmountMinor: 1, discountPercent: 0, imageCount: 5 }),
    ).toContain('Максимум 4 изображений');
    expect(
      validateProduct({ title: 'A', originalAmountMinor: 1, discountPercent: 0, imageCount: 4 }),
    ).toEqual([]);
  });
});

describe('compareProductsForDisplay', () => {
  it('sorts active before archived', () => {
    const archived = makeProduct({ id: 'a', status: 'ARCHIVED' });
    const active = makeProduct({ id: 'b', status: 'ACTIVE' });
    expect([archived, active].sort(compareProductsForDisplay).map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('sorts by sortOrder then createdAt', () => {
    const a = makeProduct({ id: 'a', sortOrder: 2 });
    const b = makeProduct({ id: 'b', sortOrder: 1, createdAt: '2026-01-03T00:00:00.000Z' });
    const c = makeProduct({ id: 'c', sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' });
    expect([a, b, c].sort(compareProductsForDisplay).map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('isInStock', () => {
  it('reflects positive available quantity', () => {
    expect(isInStock(1)).toBe(true);
    expect(isInStock(0)).toBe(false);
  });
});

describe('formatMoneyMinor', () => {
  it('formats minor units with and without symbol', () => {
    expect(formatMoneyMinor(1234, '₽')).toBe('12.34 ₽');
    expect(formatMoneyMinor(1000, '$')).toBe('10 $');
    expect(formatMoneyMinor(0, '')).toBe('0');
  });
});

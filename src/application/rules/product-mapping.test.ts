import { describe, expect, it } from 'vitest';
import { UNCATEGORIZED_ID } from '../../domain/constants/categories';
import type { ProductFormPayload } from '../read-models/inventory-view';
import { resolveCategoryId, toCatalogFields } from './product-mapping';
import type { InheritanceMode } from './variant-form';

interface VariantOverrides {
  id?: string;
  name?: string;
  value?: string;
  quantity?: number;
  priceMinor?: number;
  discountPercent?: number;
  priceMode?: InheritanceMode;
  discountMode?: InheritanceMode;
}

function variant(overrides: VariantOverrides = {}) {
  return {
    name: 'Объём',
    value: '1 кг',
    quantity: 5,
    priceMinor: 190000,
    discountPercent: 0,
    priceMode: 'INHERITED' as const,
    discountMode: 'INHERITED' as const,
    ...overrides,
  };
}

function makePayload(overrides: Partial<ProductFormPayload> = {}): ProductFormPayload {
  return {
    title: ' Морковь ',
    description: ' свежая ',
    categoryId: 'cat-1',
    status: 'ACTIVE',
    images: [{ url: 'full.jpg', thumbUrl: 'thumb.jpg' }],
    attributes: [{ name: 'Материал', value: 'Хлопок' }],
    variants: [variant(), variant({ value: '2 кг' })],
    ...overrides,
  };
}

describe('toCatalogFields — независимые оси (docs/20 §3.1)', () => {
  it('inherited/inherited → USE_PRODUCT_PRICE и оба поля null', () => {
    const fields = toCatalogFields(makePayload());
    expect(fields.variants[1]).toEqual({
      id: undefined,
      name: 'Объём',
      value: '2 кг',
      availableQuantity: 5,
      priceMode: 'USE_PRODUCT_PRICE',
      customOriginalAmountMinor: null,
      customDiscountPercent: null,
    });
  });

  it('custom price / inherited discount → только custom-цена', () => {
    const fields = toCatalogFields(
      makePayload({
        variants: [variant(), variant({ value: '2 кг', priceMinor: 220000, priceMode: 'CUSTOM' })],
      }),
    );
    expect(fields.variants[1]).toMatchObject({
      priceMode: 'CUSTOM_PRICE',
      customOriginalAmountMinor: 220000,
      customDiscountPercent: null,
    });
  });

  it('inherited price / custom discount → только custom-скидка', () => {
    const fields = toCatalogFields(
      makePayload({
        variants: [variant(), variant({ value: '2 кг', discountPercent: 20, discountMode: 'CUSTOM' })],
      }),
    );
    expect(fields.variants[1]).toMatchObject({
      priceMode: 'CUSTOM_PRICE',
      customOriginalAmountMinor: null,
      customDiscountPercent: 20,
    });
  });

  it('custom/custom → обе оси свои', () => {
    const fields = toCatalogFields(
      makePayload({
        variants: [
          variant(),
          variant({
            value: '2 кг',
            priceMinor: 220000,
            discountPercent: 15,
            priceMode: 'CUSTOM',
            discountMode: 'CUSTOM',
          }),
        ],
      }),
    );
    expect(fields.variants[1]).toMatchObject({
      priceMode: 'CUSTOM_PRICE',
      customOriginalAmountMinor: 220000,
      customDiscountPercent: 15,
    });
  });

  it('custom-ось фиксируется режимом, даже если значение равно базовому', () => {
    const fields = toCatalogFields(
      makePayload({
        variants: [variant(), variant({ value: '2 кг', priceMinor: 190000, priceMode: 'CUSTOM' })],
      }),
    );
    expect(fields.variants[1].customOriginalAmountMinor).toBe(190000);
  });

  it('базовая цена/скидка товара берутся из первого заполненного варианта', () => {
    const fields = toCatalogFields(
      makePayload({
        variants: [
          variant({ value: '', priceMinor: 1, discountPercent: 1 }),
          variant({ value: '1 кг', priceMinor: 190000, discountPercent: 10 }),
          variant({ value: '2 кг' }),
        ],
      }),
    );
    expect(fields.originalAmountMinor).toBe(190000);
    expect(fields.discountPercent).toBe(10);
    expect(fields.variants).toHaveLength(2);
  });

  it('тримит поля, мапит изображения и атрибуты', () => {
    const fields = toCatalogFields(makePayload());
    expect(fields.title).toBe('Морковь');
    expect(fields.description).toBe('свежая');
    expect(fields.images).toEqual([{ storageKey: 'full.jpg', thumbStorageKey: 'thumb.jpg' }]);
    expect(fields.attributes).toEqual([{ name: 'Материал', value: 'Хлопок' }]);
    expect(fields.linkAttributes).toEqual([]);
  });
});

describe('resolveCategoryId', () => {
  it('пустая строка и системная категория → null', () => {
    expect(resolveCategoryId('')).toBeNull();
    expect(resolveCategoryId(UNCATEGORIZED_ID)).toBeNull();
  });

  it('реальный id сохраняется', () => {
    expect(resolveCategoryId('cat-9')).toBe('cat-9');
  });
});

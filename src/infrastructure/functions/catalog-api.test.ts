import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeFunction } = vi.hoisted(() => ({ invokeFunction: vi.fn() }));
vi.mock('../insforge/functions-gateway', () => ({ invokeFunction }));

import {
  createProduct,
  updateProduct,
  createVariant,
  setStatus,
  deleteProduct,
  deleteCategory,
} from './catalog-api';

function ok(result: unknown = {}) {
  return { data: { success: true, result }, error: null };
}

beforeEach(() => invokeFunction.mockReset());

describe('catalog-api', () => {
  it('createProduct маппит domain → snake_case и вызывает catalog-actions', async () => {
    invokeFunction.mockResolvedValue(ok({ productId: 'p1' }));

    await createProduct('tok', {
      storeId: 's1',
      title: 'T',
      description: 'D',
      originalAmountMinor: 1000,
      discountPercent: 10,
      categoryId: 'c1',
      status: 'ACTIVE',
      images: [{ storageKey: 'full', thumbStorageKey: 'thumb' }],
      variants: [{ name: 'Размер', value: 'M', availableQuantity: 5 }],
      attributes: [{ name: 'a', value: 'b' }],
      linkAttributes: [],
    });

    expect(invokeFunction).toHaveBeenCalledWith('catalog-actions', {
      token: 'tok',
      body: {
        action: 'product-create',
        storeId: 's1',
        product: {
          title: 'T',
          description: 'D',
          category_id: 'c1',
          original_amount_minor: 1000,
          discount_percent: 10,
          status: 'ACTIVE',
        },
        images: [{ storage_key: 'full', thumb_storage_key: 'thumb' }],
        attributes: [{ name: 'a', value: 'b' }],
        linkAttributes: [],
        variants: [
          {
            name: 'Размер',
            value: 'M',
            available_quantity: 5,
            price_mode: 'USE_PRODUCT_PRICE',
            custom_original_amount_minor: null,
            custom_discount_percent: null,
          },
        ],
      },
    });
  });

  it('updateProduct presence-keyed и сохраняет id варианта (неразрушающий diff)', async () => {
    invokeFunction.mockResolvedValue(ok({ productId: 'p1' }));

    await updateProduct('tok', 'p1', {
      title: 'T2',
      variants: [{ id: 'v1', name: 'Размер', value: 'M', availableQuantity: 9 }],
    });

    const [, opts] = invokeFunction.mock.calls[0] as [
      string,
      { body: { action: string; productId: string; patch: Record<string, unknown> } },
    ];
    expect(opts.body).toEqual({
      action: 'product-update',
      productId: 'p1',
      patch: {
        title: 'T2',
        variants: [
          {
            id: 'v1',
            name: 'Размер',
            value: 'M',
            available_quantity: 9,
            price_mode: 'USE_PRODUCT_PRICE',
            custom_original_amount_minor: null,
            custom_discount_percent: null,
          },
        ],
      },
    });
    expect(opts.body.patch).not.toHaveProperty('description');
    expect(opts.body.patch).not.toHaveProperty('images');
    expect(opts.body.patch).not.toHaveProperty('category_id');
  });

  it('createVariant передаёт базовую цену первого варианта', async () => {
    invokeFunction.mockResolvedValue(ok({ productId: 'p1', variantId: 'v1' }));

    await createVariant('tok', 'p1', {
      name: 'Размер',
      value: 'S',
      availableQuantity: 2,
      baseOriginalAmountMinor: 500,
      baseDiscountPercent: 5,
    });

    const [, opts] = invokeFunction.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(opts.body).toMatchObject({
      action: 'variant-create',
      productId: 'p1',
      baseOriginalAmountMinor: 500,
      baseDiscountPercent: 5,
    });
  });

  it('deleteProduct разворачивает ключи фото из images', async () => {
    invokeFunction.mockResolvedValue(
      ok({ images: [{ storage_key: 'f', thumb_storage_key: 't' }, { storage_key: 'f2', thumb_storage_key: null }] }),
    );

    await expect(deleteProduct('tok', 'p1')).resolves.toEqual([
      { storageKey: 'f', thumbStorageKey: 't' },
      { storageKey: 'f2', thumbStorageKey: null },
    ]);
  });

  it('deleteCategory возвращает ключ обложки', async () => {
    invokeFunction.mockResolvedValue(ok({ imageStorageKey: 'cover' }));
    await expect(deleteCategory('tok', 'c1')).resolves.toBe('cover');
  });

  it('бросает код серверной ошибки', async () => {
    invokeFunction.mockResolvedValue({ data: { success: false, error: 'FORBIDDEN' }, error: null });
    await expect(setStatus('tok', 'p1', 'ACTIVE')).rejects.toThrow('FORBIDDEN');
  });

  it('бросает ошибку транспорта', async () => {
    invokeFunction.mockResolvedValue({ data: null, error: { message: 'Unauthorized' } });
    await expect(deleteCategory('tok', 'c1')).rejects.toThrow('Unauthorized');
  });
});

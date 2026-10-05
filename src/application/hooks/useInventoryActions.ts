import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { UNCATEGORIZED_ID } from '../../domain/constants/categories';
import type { ProductStatus } from '../../domain/models/product';
import { ProductStatusError } from '../contracts/product-status';
import type {
  NewInventoryVariant,
  ProductFormPayload,
  UpdateVariantStockPatch,
} from '../read-models/inventory-view';
import type { AddVariantInput, NewProductInput, UpdateProductPatch } from '../contracts/product';
import { resolveCategoryId, toCatalogFields } from '../rules/product-mapping';
import { useStore } from '../store';

export type {
  NewInventoryProduct,
  NewInventoryVariant,
  ProductFormPayload,
  UpdateInventoryProductPatch,
  UpdateVariantStockPatch,
} from '../read-models/inventory-view';

export interface CreateCategoryInput {
  name: string;
  imageStorageKey?: string | null;
  lowStockThreshold?: number | null;
}

export interface UpdateCategoryInput {
  name?: string;
  imageStorageKey?: string | null;
  lowStockThreshold?: number | null;
}

/**
 * Create/Edit-сценарии Inventory. Все мутации идут через Zustand-слайсы,
 * которые пишут в InsForge и обновляют локальный стейт.
 *
 * Ошибки пользовательских мутаций НЕ проглатываются: они бросаются дальше,
 * чтобы Presentation мог показать ошибку и не терять форму (docs/19 §13).
 */
export function useInventoryActions() {
  const navigate = useNavigate();

  const createCategory = useCallback(
    async (input: CreateCategoryInput) => {
      await useStore.getState().addCategory(input);
      navigate('/seller/inventory');
    },
    [navigate],
  );

  const updateCategory = useCallback(async (id: string, patch: UpdateCategoryInput) => {
    await useStore.getState().updateCategory(id, patch);
  }, []);

  /** Удаляет категорию (товары → «Без категории», обложка → из Storage). Ошибка → throw. */
  const deleteCategory = useCallback(async (id: string): Promise<void> => {
    await useStore.getState().deleteCategory(id);
  }, []);

  /** Переставляет категорию на позицию 1..N (порядок витрины покупателя). Ошибка → throw. */
  const reorderCategory = useCallback(async (id: string, position: number): Promise<void> => {
    await useStore.getState().reorderCategory(id, position);
  }, []);

  const createProduct = useCallback(
    async (payload: ProductFormPayload) => {
      const { storeId } = useStore.getState();
      if (!storeId) throw new Error('Магазин не выбран');
      const input: NewProductInput = { storeId, ...toCatalogFields(payload) };
      await useStore.getState().saveProduct(input);
      navigate('/seller/inventory');
    },
    [navigate],
  );

  const updateProduct = useCallback(async (id: string, payload: ProductFormPayload) => {
    const patch: UpdateProductPatch = toCatalogFields(payload);
    await useStore.getState().saveProduct({ id, ...patch });
  }, []);

  /** Массово добавить/перенести товары в категорию (кнопка «+» в блоке категории). */
  const assignProductsToCategory = useCallback(
    async (categoryId: string, productIds: string[]) => {
      await useStore
        .getState()
        .assignProductsCategory(productIds, resolveCategoryId(categoryId));
    },
    [],
  );

  /** Архив/витрина товара. Бизнес-отказ → `ProductStatusError` (с машинным кодом). */
  const setProductStatus = useCallback(async (id: string, status: ProductStatus): Promise<void> => {
    const result =
      status === 'ARCHIVED'
        ? await useStore.getState().archiveProduct(id)
        : await useStore.getState().restoreProduct(id);
    if (!result.ok) throw new ProductStatusError(result.code, result.message);
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await useStore.getState().deleteProduct(id);
  }, []);

  const updateVariantStock = useCallback(
    async (variantId: string, patch: UpdateVariantStockPatch) => {
      await useStore.getState().updateVariantStock(variantId, patch);
    },
    [],
  );

  const addVariant = useCallback(async (productId: string, input: NewInventoryVariant) => {
    const state = useStore.getState();
    const product = state.products.find((p) => p.id === productId) ?? null;
    const isFirst = !state.variants.some((v) => v.productId === productId);
    const basePrice = product?.originalAmountMinor ?? input.priceMinor;
    const baseDiscount = product?.discountPercent ?? input.discountPercent;
    // Независимые оси (docs/20 §3.1): каждая ось переопределяется сама по себе.
    const priceCustom = !isFirst && input.priceMinor !== basePrice;
    const discountCustom = !isFirst && input.discountPercent !== baseDiscount;
    const hasCustom = priceCustom || discountCustom;

    const variant: AddVariantInput = {
      name: input.name.trim() || 'Вариант',
      value: input.value.trim(),
      availableQuantity: Math.max(
        0,
        Math.round(Number.isFinite(input.quantity) ? input.quantity : 0),
      ),
      priceMode: hasCustom ? 'CUSTOM_PRICE' : 'USE_PRODUCT_PRICE',
      customOriginalAmountMinor: priceCustom ? input.priceMinor : null,
      customDiscountPercent: discountCustom ? input.discountPercent : null,
      baseOriginalAmountMinor: isFirst ? input.priceMinor : undefined,
      baseDiscountPercent: isFirst ? input.discountPercent : undefined,
    };

    await state.addVariant(productId, variant);
  }, []);

  const moveHeldToAvailable = useCallback(async (variantId: string, quantity?: number) => {
    await useStore.getState().moveHeldToAvailable(variantId, quantity);
  }, []);

  return {
    createCategory,
    createProduct,
    updateCategory,
    deleteCategory,
    reorderCategory,
    updateProduct,
    assignProductsToCategory,
    setProductStatus,
    deleteProduct,
    updateVariantStock,
    addVariant,
    moveHeldToAvailable,
  };
}

/** Быстрый переход к форме создания товара в контексте категории (или без неё). */
export function createProductPath(categoryId: string | null): string {
  if (!categoryId || categoryId === UNCATEGORIZED_ID) return '/seller/inventory/product/new';
  return `/seller/inventory/product/new?categoryId=${encodeURIComponent(categoryId)}`;
}

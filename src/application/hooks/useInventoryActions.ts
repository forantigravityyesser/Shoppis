import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { UNCATEGORIZED_ID } from '../../domain/constants/categories';
import type { ProductStatus } from '../../domain/models/product';
import type { ProductStatusResult } from '../contracts/product-status';
import type {
  NewInventoryVariant,
  ProductFormPayload,
  UpdateVariantStockPatch,
} from '../read-models/inventory-view';
import type { AddVariantInput, NewProductInput, UpdateProductPatch } from '../contracts/product';
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

/** Системная «Без категории» хранится в БД как category_id = null. */
function resolveCategoryId(categoryId: string): string | null {
  return categoryId && categoryId !== UNCATEGORIZED_ID ? categoryId : null;
}

interface CatalogFields {
  title: string;
  description: string;
  categoryId: string | null;
  originalAmountMinor: number;
  discountPercent: number;
  status: ProductStatus;
  images: NewProductInput['images'];
  variants: NewProductInput['variants'];
  attributes: Array<{ name: string; value: string }>;
  linkAttributes: Array<{ name: string; value: string }>;
}

/**
 * Форма → поля каталога. Первый (заполненный) вариант задаёт базовую цену/скидку товара;
 * вариант с явным режимом CUSTOM по цене или скидке становится CUSTOM_PRICE.
 * Пустая категория → null.
 */
function toCatalogFields(payload: ProductFormPayload): CatalogFields {
  const filled = payload.variants.filter((v) => v.value.trim());
  const base = filled[0] ?? null;
  const basePrice = base?.priceMinor ?? 0;
  const baseDiscount = base?.discountPercent ?? 0;

  const variants = filled.map((v) => {
    const custom = v.priceMode === 'CUSTOM' || v.discountMode === 'CUSTOM';
    return {
      id: v.id,
      name: v.name.trim() || 'Вариант',
      value: v.value.trim(),
      availableQuantity: Math.max(0, Math.round(Number.isFinite(v.quantity) ? v.quantity : 0)),
      priceMode: custom ? ('CUSTOM_PRICE' as const) : ('USE_PRODUCT_PRICE' as const),
      customOriginalAmountMinor: custom ? v.priceMinor : null,
      customDiscountPercent: custom ? v.discountPercent : null,
    };
  });

  return {
    title: payload.title.trim(),
    description: (payload.description ?? '').trim(),
    categoryId: resolveCategoryId(payload.categoryId),
    originalAmountMinor: basePrice,
    discountPercent: baseDiscount,
    status: payload.status,
    images: payload.images.map((image) => ({
      storageKey: image.url,
      thumbStorageKey: image.thumbUrl,
    })),
    variants,
    attributes: payload.attributes,
    linkAttributes: [],
  };
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

  /** Удаляет категорию (товары → «Без категории», обложка → из Storage). true — успех. */
  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    try {
      await useStore.getState().deleteCategory(id);
      return true;
    } catch (e) {
      console.error('[inventory] deleteCategory failed', e);
      return false;
    }
  }, []);

  /** Переставляет категорию на позицию 1..N (порядок витрины покупателя). true — успех. */
  const reorderCategory = useCallback(async (id: string, position: number): Promise<boolean> => {
    try {
      await useStore.getState().reorderCategory(id, position);
      return true;
    } catch (e) {
      console.error('[inventory] reorderCategory failed', e);
      return false;
    }
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

  const setProductStatus = useCallback(
    async (id: string, status: ProductStatus): Promise<ProductStatusResult> => {
      const result =
        status === 'ARCHIVED'
          ? await useStore.getState().archiveProduct(id)
          : await useStore.getState().restoreProduct(id);
      if (!result.ok) {
        console.error('[inventory] setProductStatus failed', result.code, result.message);
      }
      return result;
    },
    [],
  );

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
    const useCustom =
      !isFirst && (input.priceMinor !== basePrice || input.discountPercent !== baseDiscount);

    const variant: AddVariantInput = {
      name: input.name.trim() || 'Вариант',
      value: input.value.trim(),
      availableQuantity: Math.max(
        0,
        Math.round(Number.isFinite(input.quantity) ? input.quantity : 0),
      ),
      priceMode: useCustom ? 'CUSTOM_PRICE' : 'USE_PRODUCT_PRICE',
      customOriginalAmountMinor: useCustom ? input.priceMinor : null,
      customDiscountPercent: useCustom ? input.discountPercent : null,
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

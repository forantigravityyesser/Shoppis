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
 * Форма → поля каталога. Первый вариант задаёт базовую цену/скидку товара;
 * остальные с иной ценой становятся CUSTOM_PRICE. Пустая категория → null.
 */
function toCatalogFields(payload: ProductFormPayload): CatalogFields {
  const filled = payload.variants.filter((v) => v.value.trim());
  const base = filled[0] ?? null;
  const basePrice = base?.priceMinor ?? 0;
  const baseDiscount = base?.discountPercent ?? 0;

  const variants = filled.map((v) => {
    const useCustom = v.priceMinor !== basePrice || v.discountPercent !== baseDiscount;
    return {
      name: v.name.trim() || 'Вариант',
      value: v.value.trim(),
      availableQuantity: Math.max(0, Math.round(Number.isFinite(v.quantity) ? v.quantity : 0)),
      priceMode: useCustom ? ('CUSTOM_PRICE' as const) : ('USE_PRODUCT_PRICE' as const),
      customOriginalAmountMinor: useCustom ? v.priceMinor : null,
      customDiscountPercent: useCustom ? v.discountPercent : null,
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
 */
export function useInventoryActions() {
  const navigate = useNavigate();

  const createCategory = useCallback(
    async (input: CreateCategoryInput) => {
      try {
        await useStore.getState().addCategory(input);
        navigate('/seller/inventory');
      } catch (e) {
        console.error('[inventory] createCategory failed', e);
      }
    },
    [navigate],
  );

  const updateCategory = useCallback(async (id: string, patch: UpdateCategoryInput) => {
    try {
      await useStore.getState().updateCategory(id, patch);
    } catch (e) {
      console.error('[inventory] updateCategory failed', e);
    }
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

  const createProduct = useCallback(
    async (payload: ProductFormPayload) => {
      try {
        const { storeId } = useStore.getState();
        if (!storeId) throw new Error('No store selected');
        const input: NewProductInput = { storeId, ...toCatalogFields(payload) };
        await useStore.getState().saveProduct(input);
        navigate('/seller/inventory');
      } catch (e) {
        console.error('[inventory] createProduct failed', e);
      }
    },
    [navigate],
  );

  const updateProduct = useCallback(async (id: string, payload: ProductFormPayload) => {
    try {
      const patch: UpdateProductPatch = toCatalogFields(payload);
      await useStore.getState().saveProduct({ id, ...patch });
    } catch (e) {
      console.error('[inventory] updateProduct failed', e);
    }
  }, []);

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
    try {
      await useStore.getState().deleteProduct(id);
    } catch (e) {
      console.error('[inventory] deleteProduct failed', e);
    }
  }, []);

  const updateVariantStock = useCallback(
    async (variantId: string, patch: UpdateVariantStockPatch) => {
      try {
        await useStore.getState().updateVariantStock(variantId, patch);
      } catch (e) {
        console.error('[inventory] updateVariantStock failed', e);
      }
    },
    [],
  );

  const addVariant = useCallback(async (productId: string, input: NewInventoryVariant) => {
    try {
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
    } catch (e) {
      console.error('[inventory] addVariant failed', e);
    }
  }, []);

  const moveHeldToAvailable = useCallback(async (variantId: string, quantity?: number) => {
    try {
      await useStore.getState().moveHeldToAvailable(variantId, quantity);
    } catch (e) {
      console.error('[inventory] moveHeldToAvailable failed', e);
    }
  }, []);

  return {
    createCategory,
    createProduct,
    updateCategory,
    deleteCategory,
    updateProduct,
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

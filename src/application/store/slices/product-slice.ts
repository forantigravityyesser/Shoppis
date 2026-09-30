import type { StateCreator } from 'zustand';
import { validateProduct } from '../../../domain/rules/product-rules';
import { ProductStatusError, type ProductStatusResult } from '../../contracts/product-status';
import type {
  AddVariantInput,
  NewProductInput,
  UpdateProductPatch,
  VariantStockPatch,
} from '../../contracts/product';
import type {
  Inventory,
  Product,
  ProductAttribute,
  ProductImage,
  ProductLinkAttribute,
  Variant,
} from '../../../domain/models/product';
import { deps } from '../../composition/container';
import type { RootStore } from '../index';

function toStatusResult(error: unknown): ProductStatusResult {
  if (error instanceof ProductStatusError) {
    return { ok: false, code: error.code, message: error.message };
  }
  const message = error instanceof Error ? error.message : 'Не удалось изменить статус';
  return { ok: false, code: 'UNKNOWN', message };
}

export interface ProductSlice {
  products: Product[];
  variants: Variant[];
  inventories: Inventory[];
  images: ProductImage[];
  attributes: ProductAttribute[];
  linkAttributes: ProductLinkAttribute[];
  catalogLoading: boolean;
  catalogError: string | null;
  catalogStoreId: string | null;
  fetchCatalog: (storeId: string) => Promise<void>;
  ensureCatalog: (storeId: string) => Promise<void>;
  resetCatalog: () => void;
  saveProduct: (input: NewProductInput | ({ id: string } & UpdateProductPatch)) => Promise<void>;
  archiveProduct: (id: string) => Promise<ProductStatusResult>;
  restoreProduct: (id: string) => Promise<ProductStatusResult>;
  deleteProduct: (id: string) => Promise<void>;
  updateVariantStock: (variantId: string, patch: VariantStockPatch) => Promise<void>;
  addVariant: (productId: string, variant: AddVariantInput) => Promise<void>;
  moveHeldToAvailable: (variantId: string, quantity?: number) => Promise<void>;
}

export const createProductSlice: StateCreator<RootStore, [], [], ProductSlice> = (set, get) => ({
  products: [],
  variants: [],
  inventories: [],
  images: [],
  attributes: [],
  linkAttributes: [],
  catalogLoading: false,
  catalogError: null,
  catalogStoreId: null,

  fetchCatalog: async (storeId: string) => {
    set({ catalogLoading: true, catalogError: null });
    try {
      const catalog = await deps().productRepository.fetchCatalog(storeId);
      set({ ...catalog, catalogLoading: false, catalogStoreId: storeId });
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      throw e;
    }
  },

  ensureCatalog: async (storeId: string) => {
    const { catalogStoreId, catalogLoading } = get();
    if (catalogLoading || catalogStoreId === storeId) return;
    await get().fetchCatalog(storeId);
  },

  resetCatalog: () =>
    set({
      products: [],
      variants: [],
      inventories: [],
      images: [],
      attributes: [],
      linkAttributes: [],
      catalogError: null,
      catalogStoreId: null,
    }),

  saveProduct: async (input) => {
    const { storeId, sessionToken } = get();
    if (!storeId) throw new Error('No store selected');
    set({ catalogLoading: true, catalogError: null });
    try {
      if ('id' in input) {
        const { id, ...patch } = input;
        const probe = get().products.find((p) => p.id === id);
        const errors = validateProduct({
          title: patch.title ?? probe?.title ?? '',
          originalAmountMinor: patch.originalAmountMinor ?? probe?.originalAmountMinor ?? 1,
          discountPercent: patch.discountPercent ?? probe?.discountPercent ?? 0,
          imageCount: patch.images?.length ?? get().images.filter((i) => i.productId === id).length,
        });
        if (errors.length) throw new Error(errors.join('; '));

        const previousImages = get().images.filter((i) => i.productId === id);
        await deps().productRepository.updateProduct(id, patch, sessionToken);

        // Удаляем из Storage откреплённые при правке фото (full + thumb), best-effort.
        if (patch.images !== undefined) {
          const keepFull = new Set(patch.images.map((i) => i.storageKey));
          const keepThumbs = new Set(
            patch.images.map((i) => i.thumbStorageKey).filter((k): k is string => Boolean(k)),
          );
          void deps().storage.removeFilesByUrl(
            previousImages.flatMap((img) => [
              keepFull.has(img.storageKey) ? null : img.storageKey,
              img.thumbStorageKey && !keepThumbs.has(img.thumbStorageKey)
                ? img.thumbStorageKey
                : null,
            ]),
          );
        }
      } else {
        const errors = validateProduct({
          title: input.title,
          originalAmountMinor: input.originalAmountMinor,
          discountPercent: input.discountPercent,
          imageCount: input.images.length,
        });
        if (errors.length) throw new Error(errors.join('; '));
        await deps().productRepository.addProduct(input, sessionToken);
      }
      await get().fetchCatalog(storeId);
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      throw e;
    }
  },

  archiveProduct: async (id: string) => {
    const { storeId, sessionToken } = get();
    if (!storeId) return { ok: false, code: 'UNKNOWN', message: 'Магазин не выбран' };
    set({ catalogLoading: true, catalogError: null });
    try {
      await deps().productRepository.setProductStatus(id, 'ARCHIVED', sessionToken);
      await get().fetchCatalog(storeId);
      return { ok: true };
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      return toStatusResult(e);
    }
  },

  restoreProduct: async (id: string) => {
    const { storeId, sessionToken } = get();
    if (!storeId) return { ok: false, code: 'UNKNOWN', message: 'Магазин не выбран' };
    set({ catalogLoading: true, catalogError: null });
    try {
      await deps().productRepository.setProductStatus(id, 'ACTIVE', sessionToken);
      await get().fetchCatalog(storeId);
      return { ok: true };
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      return toStatusResult(e);
    }
  },

  deleteProduct: async (id: string) => {
    const { storeId, sessionToken } = get();
    if (!storeId) throw new Error('No store selected');
    set({ catalogLoading: true, catalogError: null });
    try {
      const removed = await deps().productRepository.deleteProduct(id, sessionToken);
      // Чистим файлы удалённого товара (full + thumb), best-effort.
      void deps().storage.removeFilesByUrl(
        removed.flatMap((img) => [img.storageKey, img.thumbStorageKey]),
      );
      await get().fetchCatalog(storeId);
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      throw e;
    }
  },

  updateVariantStock: async (variantId: string, patch: VariantStockPatch) => {
    try {
      await deps().productRepository.updateVariantStock(variantId, patch);
      set((s) => ({
        inventories: s.inventories.map((row) =>
          row.variantId === variantId
            ? {
                ...row,
                availableQuantity:
                  patch.availableQuantity !== undefined
                    ? Math.max(0, Math.round(patch.availableQuantity))
                    : row.availableQuantity,
                heldQuantity:
                  patch.heldQuantity !== undefined
                    ? Math.max(0, Math.round(patch.heldQuantity))
                    : row.heldQuantity,
              }
            : row,
        ),
      }));
    } catch (e) {
      set({ catalogError: (e as Error).message });
      throw e;
    }
  },

  addVariant: async (productId: string, variant: AddVariantInput) => {
    const { storeId, sessionToken } = get();
    if (!storeId) throw new Error('No store selected');
    set({ catalogLoading: true, catalogError: null });
    try {
      await deps().productRepository.addVariantToProduct(productId, variant, sessionToken);
      await get().fetchCatalog(storeId);
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      throw e;
    }
  },

  moveHeldToAvailable: async (variantId: string, quantity?: number) => {
    const row = get().inventories.find((i) => i.variantId === variantId);
    if (!row) return;
    const requested = quantity === undefined ? row.heldQuantity : Math.max(0, Math.round(quantity));
    const moved = Math.min(requested, row.heldQuantity);
    if (moved <= 0) return;
    await get().updateVariantStock(variantId, {
      availableQuantity: row.availableQuantity + moved,
      heldQuantity: row.heldQuantity - moved,
    });
  },
});

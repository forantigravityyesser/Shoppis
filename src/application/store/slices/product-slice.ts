import type { StateCreator } from 'zustand';
import { validateProduct } from '../../../domain/rules/product-rules';
import type {
  Inventory,
  Product,
  ProductAttribute,
  ProductImage,
  ProductLinkAttribute,
  Variant,
} from '../../../domain/models/product';
import {
  addProduct as addProductRepo,
  deleteProduct as deleteProductRepo,
  fetchCatalog as fetchCatalogRepo,
  setProductStatus as setProductStatusRepo,
  updateProduct as updateProductRepo,
  type NewProductInput,
  type UpdateProductPatch,
} from '../../../infrastructure/repositories/product-repository';
import type { RootStore } from '../index';

export interface ProductSlice {
  products: Product[];
  variants: Variant[];
  inventories: Inventory[];
  images: ProductImage[];
  attributes: ProductAttribute[];
  linkAttributes: ProductLinkAttribute[];
  catalogLoading: boolean;
  catalogError: string | null;
  fetchCatalog: (storeId: string) => Promise<void>;
  resetCatalog: () => void;
  saveProduct: (input: NewProductInput | ({ id: string } & UpdateProductPatch)) => Promise<void>;
  archiveProduct: (id: string) => Promise<void>;
  restoreProduct: (id: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
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

  fetchCatalog: async (storeId: string) => {
    set({ catalogLoading: true, catalogError: null });
    try {
      const catalog = await fetchCatalogRepo(storeId);
      set({ ...catalog, catalogLoading: false });
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      throw e;
    }
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
    }),

  saveProduct: async (input) => {
    const { storeId } = get();
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
        await updateProductRepo(id, patch);
      } else {
        const errors = validateProduct({
          title: input.title,
          originalAmountMinor: input.originalAmountMinor,
          discountPercent: input.discountPercent,
          imageCount: input.images.length,
        });
        if (errors.length) throw new Error(errors.join('; '));
        await addProductRepo(input);
      }
      await get().fetchCatalog(storeId);
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      throw e;
    }
  },

  archiveProduct: async (id: string) => {
    const { storeId } = get();
    if (!storeId) throw new Error('No store selected');
    set({ catalogLoading: true, catalogError: null });
    try {
      await setProductStatusRepo(id, 'ARCHIVED');
      await get().fetchCatalog(storeId);
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      throw e;
    }
  },

  restoreProduct: async (id: string) => {
    const { storeId } = get();
    if (!storeId) throw new Error('No store selected');
    set({ catalogLoading: true, catalogError: null });
    try {
      await setProductStatusRepo(id, 'ACTIVE');
      await get().fetchCatalog(storeId);
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      throw e;
    }
  },

  deleteProduct: async (id: string) => {
    const { storeId } = get();
    if (!storeId) throw new Error('No store selected');
    set({ catalogLoading: true, catalogError: null });
    try {
      await deleteProductRepo(id);
      await get().fetchCatalog(storeId);
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      throw e;
    }
  },
});

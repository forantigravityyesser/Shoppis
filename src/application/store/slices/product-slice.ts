import type { StateCreator } from 'zustand';
import { validateProduct } from '../../../domain/rules/product-rules';
import type {
  Product,
  ProductCharacteristic,
  ProductVariant,
} from '../../../domain/models/product';
import {
  addProduct as addProductRepo,
  fetchCatalog as fetchCatalogRepo,
  removeProduct as removeProductRepo,
  updateProduct as updateProductRepo,
  type NewProductInput,
  type UpdateProductPatch,
} from '../../../infrastructure/repositories/product-repository';
import type { RootStore } from '../index';

export interface ProductSlice {
  products: Product[];
  variants: ProductVariant[];
  characteristics: ProductCharacteristic[];
  catalogLoading: boolean;
  catalogError: string | null;
  fetchCatalog: (storeId: string) => Promise<void>;
  resetCatalog: () => void;
  saveProduct: (input: NewProductInput | ({ id: string } & UpdateProductPatch)) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
}

export const createProductSlice: StateCreator<RootStore, [], [], ProductSlice> = (set, get) => ({
  products: [],
  variants: [],
  characteristics: [],
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

  resetCatalog: () => set({ products: [], variants: [], characteristics: [], catalogError: null }),

  saveProduct: async (input) => {
    const { storeId } = get();
    if (!storeId) throw new Error('No store selected');
    set({ catalogLoading: true, catalogError: null });
    try {
      let saved: Product;
      if ('id' in input) {
        const { id, ...patch } = input;
        if (patch.title !== undefined || patch.originalPrice !== undefined) {
          const probe = get().products.find((p) => p.id === id);
          const errors = validateProduct({
            title: patch.title ?? probe?.title ?? '',
            price: patch.originalPrice ?? probe?.oldPrice ?? probe?.price ?? 0,
            discountPercent: patch.discountPercent ?? probe?.discountPercent ?? 0,
            imageUrls: patch.imageUrls ?? probe?.imageUrls ?? [],
          });
          if (errors.length) throw new Error(errors.join('; '));
        }
        saved = await updateProductRepo(id, patch);
      } else {
        const errors = validateProduct({
          title: input.title,
          price: input.originalPrice,
          discountPercent: input.discountPercent,
          imageUrls: input.imageUrls,
        });
        if (errors.length) throw new Error(errors.join('; '));
        saved = await addProductRepo(input);
      }
      await get().fetchCatalog(storeId);
      return saved;
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
      await removeProductRepo(id);
      await get().fetchCatalog(storeId);
    } catch (e) {
      set({ catalogLoading: false, catalogError: (e as Error).message });
      throw e;
    }
  },
});

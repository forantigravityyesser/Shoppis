import type { StateCreator } from 'zustand';
import type { Category } from '../../../domain/models/category';
import {
  addCategory as addCategoryRepo,
  fetchCategories as fetchCategoriesRepo,
  removeCategory as removeCategoryRepo,
} from '../../../infrastructure/repositories/category-repository';
import type { RootStore } from '../index';

export interface CategorySlice {
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  fetchCategories: (storeId: string) => Promise<void>;
  addCategory: (name: string) => Promise<Category>;
  removeCategory: (id: string) => Promise<void>;
}

export const createCategorySlice: StateCreator<RootStore, [], [], CategorySlice> = (set, get) => ({
  categories: [],
  categoriesLoading: false,
  categoriesError: null,

  fetchCategories: async (storeId: string) => {
    set({ categoriesLoading: true, categoriesError: null });
    try {
      set({ categories: await fetchCategoriesRepo(storeId), categoriesLoading: false });
    } catch (e) {
      set({ categoriesLoading: false, categoriesError: (e as Error).message });
      throw e;
    }
  },

  addCategory: async (name: string) => {
    const { storeId } = get();
    if (!storeId) throw new Error('No store selected');
    const category = await addCategoryRepo(storeId, name.trim());
    set((s) => ({ categories: [...s.categories, category] }));
    return category;
  },

  removeCategory: async (id: string) => {
    await removeCategoryRepo(id);
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
  },
});

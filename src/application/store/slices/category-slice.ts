import type { StateCreator } from 'zustand';
import type { Category } from '../../../domain/models/category';
import { isSystemCategory } from '../../../domain/rules/category-rules';
import {
  addCategory as addCategoryRepo,
  deleteCategory as deleteCategoryRepo,
  fetchCategories as fetchCategoriesRepo,
  setCategoryStatus as setCategoryStatusRepo,
  updateCategory as updateCategoryRepo,
  type AddCategoryInput,
  type UpdateCategoryPatch,
} from '../../../infrastructure/repositories/category-repository';
import { removeFilesByUrl } from '../../../infrastructure/storage/file-storage';
import type { RootStore } from '../index';

export interface CategorySlice {
  categories: Category[];
  categoriesLoading: boolean;
  categoriesError: string | null;
  categoriesStoreId: string | null;
  fetchCategories: (storeId: string) => Promise<void>;
  ensureCategories: (storeId: string) => Promise<void>;
  resetCategories: () => void;
  addCategory: (input: AddCategoryInput) => Promise<Category>;
  updateCategory: (id: string, patch: UpdateCategoryPatch) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  archiveCategory: (id: string) => Promise<void>;
}

export const createCategorySlice: StateCreator<RootStore, [], [], CategorySlice> = (set, get) => ({
  categories: [],
  categoriesLoading: false,
  categoriesError: null,
  categoriesStoreId: null,

  fetchCategories: async (storeId: string) => {
    set({ categoriesLoading: true, categoriesError: null });
    try {
      set({
        categories: await fetchCategoriesRepo(storeId),
        categoriesLoading: false,
        categoriesStoreId: storeId,
      });
    } catch (e) {
      set({ categoriesLoading: false, categoriesError: (e as Error).message });
      throw e;
    }
  },

  ensureCategories: async (storeId: string) => {
    const { categoriesStoreId, categoriesLoading } = get();
    if (categoriesLoading || categoriesStoreId === storeId) return;
    await get().fetchCategories(storeId);
  },

  resetCategories: () =>
    set({ categories: [], categoriesError: null, categoriesStoreId: null }),

  addCategory: async (input: AddCategoryInput) => {
    const { storeId } = get();
    if (!storeId) throw new Error('No store selected');
    const category = await addCategoryRepo(storeId, input);
    set((s) => ({ categories: [...s.categories, category] }));
    return category;
  },

  updateCategory: async (id: string, patch: UpdateCategoryPatch) => {
    const previous = get().categories.find((c) => c.id === id) ?? null;
    await updateCategoryRepo(id, patch);
    set((s) => ({
      categories: s.categories.map((c) =>
        c.id === id
          ? {
              ...c,
              name: patch.name !== undefined ? patch.name.trim() : c.name,
              imageStorageKey:
                patch.imageStorageKey !== undefined ? patch.imageStorageKey : c.imageStorageKey,
              lowStockThreshold:
                patch.lowStockThreshold !== undefined ? patch.lowStockThreshold : c.lowStockThreshold,
            }
          : c,
      ),
    }));

    // Обложка заменена/снята — удаляем прежний файл из Storage (best-effort).
    if (
      patch.imageStorageKey !== undefined &&
      previous?.imageStorageKey &&
      previous.imageStorageKey !== patch.imageStorageKey
    ) {
      void removeFilesByUrl([previous.imageStorageKey]);
    }
  },

  deleteCategory: async (id: string) => {
    if (isSystemCategory(id)) return;

    const imageKey = await deleteCategoryRepo(id);

    // Обложка удаляется из Storage best-effort: категория уже удалена в БД.
    if (imageKey) void removeFilesByUrl([imageKey]);

    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));

    // Товары удалённой категории должны получить category_id = null в стейте.
    const { storeId } = get();
    if (storeId) {
      try {
        await get().fetchCatalog(storeId);
      } catch {
        /* ошибка уже сохранена в catalogError */
      }
    }
  },

  archiveCategory: async (id: string) => {
    await setCategoryStatusRepo(id, 'ARCHIVED');
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
  },
});

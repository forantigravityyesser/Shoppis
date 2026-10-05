import type { Category, CategoryStatus } from '../../domain/models/category';
import type { AddCategoryInput, UpdateCategoryPatch } from '../contracts/category';

export interface CategoryRepository {
  fetchCategories(storeId: string): Promise<Category[]>;
  addCategory(storeId: string, input: AddCategoryInput): Promise<Category>;
  updateCategory(id: string, patch: UpdateCategoryPatch): Promise<void>;
  deleteCategory(id: string, token: string | null): Promise<string | null>;
  /** Переставить категорию на позицию 1..N (порядок витрины); атомарно на сервере. */
  setCategoryOrder(id: string, position: number, token: string | null): Promise<void>;
  setCategoryStatus(id: string, status: CategoryStatus): Promise<void>;
}

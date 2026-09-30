import type { Category, CategoryStatus } from '../../domain/models/category';
import type { AddCategoryInput, UpdateCategoryPatch } from '../contracts/category';

export interface CategoryRepository {
  fetchCategories(storeId: string): Promise<Category[]>;
  addCategory(storeId: string, input: AddCategoryInput): Promise<Category>;
  updateCategory(id: string, patch: UpdateCategoryPatch): Promise<void>;
  deleteCategory(id: string, token: string | null): Promise<string | null>;
  setCategoryStatus(id: string, status: CategoryStatus): Promise<void>;
}

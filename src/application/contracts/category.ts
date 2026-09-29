import type { CategoryStatus } from '../../domain/models/category';

/** Вход создания категории. */
export interface AddCategoryInput {
  name: string;
  imageStorageKey?: string | null;
  lowStockThreshold?: number | null;
}

/** Патч редактирования категории. */
export interface UpdateCategoryPatch {
  name?: string;
  imageStorageKey?: string | null;
  lowStockThreshold?: number | null;
}

export type { CategoryStatus };

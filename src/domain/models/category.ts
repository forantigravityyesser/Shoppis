export type CategoryStatus = 'ACTIVE' | 'ARCHIVED';

export interface Category {
  id: string;
  storeId: string;
  name: string;
  sortOrder: number;
  status: CategoryStatus;
  createdAt: string;
  /** Обложка категории (storage key). ADR-06.3 */
  imageStorageKey?: string | null;
  /** Порог low_stock для категории; null → глобальный дефолт. ADR-06.6 */
  lowStockThreshold?: number | null;
  /** Системная категория «Без категории»: есть у каждого магазина, не редактируется и не удаляется. */
  isSystem?: boolean;
}

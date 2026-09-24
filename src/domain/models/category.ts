export type CategoryStatus = 'ACTIVE' | 'ARCHIVED';

export interface Category {
  id: string;
  storeId: string;
  name: string;
  sortOrder: number;
  status: CategoryStatus;
  createdAt: string;
}

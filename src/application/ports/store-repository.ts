import type { Store } from '../../domain/models/store';
import type { CreateStoreInput } from '../contracts/store';

export interface StoreRepository {
  fetchStore(storeId: string): Promise<Store | null>;
  fetchStoresByOwnerUser(ownerUserId: string): Promise<Store[]>;
  createStore(input: CreateStoreInput): Promise<Store>;
  checkOwnershipByUser(storeId: string, userId: string): Promise<boolean>;
  /** DEV-ONLY путь по telegram id (без серверной сессии). */
  fetchStoresByOwnerTelegram(ownerTelegramId: string): Promise<Store[]>;
  checkOwnershipByTelegram(storeId: string, ownerTelegramId: string): Promise<boolean>;
}

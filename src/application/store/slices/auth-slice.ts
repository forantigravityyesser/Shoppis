import type { StateCreator } from 'zustand';
import type { AppContext } from '../../../domain/constants/app-context';
import type { Store } from '../../../domain/models/store';
import {
  checkOwnershipByUser as checkOwnershipByUserRepo,
  createStore as createStoreRepo,
  fetchStore as fetchStoreRepo,
  fetchStoresByOwnerUser as fetchStoresByOwnerUserRepo,
  type CreateStoreInput,
} from '../../../infrastructure/repositories/store-repository';
import {
  checkOwnershipByTelegram as checkOwnershipByTelegramRepo,
  fetchStoresByOwnerTelegram as fetchStoresByOwnerTelegramRepo,
} from '../../../infrastructure/repositories/store-repository.dev';
import { createShopViaApi } from '../../../infrastructure/functions/shop-api';
import type { ServerUser } from '../../../infrastructure/functions/auth-api';
import { uploadFile } from '../../../infrastructure/storage/file-storage';
import { compressImage } from '../../../utils/image';
import type { RootStore } from '../index';

export interface AuthSlice {
  /** Серверный User — единственная authoritative identity. */
  serverUser: ServerUser | null;
  /** Контекст входа: панель продавца или витрина. Не является ролью пользователя. 01 §5 */
  context: AppContext;
  /** Runtime-сессия (HMAC), живёт только в памяти. null в dev mock. */
  sessionToken: string | null;
  /** Текущая витрина. Не персистится как identity — нет startParam = последний магазин. */
  storeId: string | null;
  /** Витрина продавца (для дашборда/онбординга) */
  currentStore: Store | null;
  authLoading: boolean;
  authError: string | null;
  /** Флаг первички как в старом useUIStore.isAppInitializing */
  isAppInitializing: boolean;
  setIsAppInitializing: (value: boolean) => void;
  setContext: (context: AppContext) => void;
  /** Установить runtime-сессию после серверной аутентификации. */
  setSession: (token: string | null, user: ServerUser | null) => void;
  /** Сбросить identity (серверная сессия stateless — достаточно очистить память). */
  clearSession: () => void;
  setStoreId: (storeId: string | null) => void;
  checkOwnership: () => Promise<boolean>;
  /**
   * Создание нового магазина.
   *
   * Вызывать ТОЛЬКО ПОСЛЕ useAppInit(), когда установлена identity.
   * С серверной сессией owner_user_id проставляет edge-функция. Без сессии
   * (dev mock) — локальный fallback по telegram id.
   */
  createStore: (input: Omit<CreateStoreInput, 'ownerTelegramId'>) => Promise<string>;
  /** Поиск витрин продавца при старте: есть — storeId + дашборд, нет — онбординг */
  loadSellerStore: () => Promise<string | null>;
  fetchCurrentStore: () => Promise<void>;
  /** Загрузка баннера в shoppis-media для формы онбординга */
  uploadStoreBanner: (file: File) => Promise<string>;
}

export const createAuthSlice: StateCreator<RootStore, [], [], AuthSlice> = (set, get) => ({
  serverUser: null,
  context: 'buyer',
  sessionToken: null,
  storeId: null,
  currentStore: null,
  authLoading: false,
  authError: null,
  isAppInitializing: true,
  setIsAppInitializing: (value) => set({ isAppInitializing: value }),

  setContext: (context) => set({ context }),

  setSession: (token, user) => set({ sessionToken: token, serverUser: user }),

  clearSession: () => set({ sessionToken: null, serverUser: null }),

  setStoreId: (storeId) => {
    if (get().storeId === storeId) return;
    get().resetCatalog();
    get().resetOrders();
    set({ storeId, currentStore: null });
  },

  checkOwnership: async () => {
    const { storeId, serverUser, sessionToken } = get();
    if (!storeId || !serverUser) return false;
    try {
      return sessionToken
        ? await checkOwnershipByUserRepo(storeId, serverUser.id)
        : await checkOwnershipByTelegramRepo(storeId, serverUser.telegramUserId);
    } catch {
      return false;
    }
  },

  createStore: async (input: Omit<CreateStoreInput, 'ownerTelegramId'>) => {
    const { serverUser, sessionToken } = get();
    if (!input.name.trim()) throw new Error('Store name is required');
    if (!serverUser) throw new Error('Not authenticated');

    set({ authLoading: true, authError: null });
    try {
      let store: Store;

      if (sessionToken) {
        // Сервер-валидированная identity: owner_user_id проставляет edge-функция.
        store = await createShopViaApi(sessionToken, {
          name: input.name.trim(),
          currency: input.currency,
          language: input.language,
          bannerUrl: input.bannerUrl,
        });
      } else {
        // DEV-ONLY: локальное создание без серверной сессии (DEV_AUTH_MODE).
        store = await createStoreRepo({
          ...input,
          name: input.name.trim(),
          ownerTelegramId: serverUser.telegramUserId,
        });
      }

      get().resetCatalog();
      get().resetOrders();
      set({ storeId: store.id, currentStore: store, authLoading: false, context: 'seller' });

      const setDefaultRecipient = get()['setDefaultRecipient'];
      if (setDefaultRecipient) {
        setDefaultRecipient({ name: serverUser.firstName || 'Пользователь', phone: '', address: '' });
      }

      return store.id;
    } catch (e) {
      set({ authLoading: false, authError: (e as Error).message });
      throw e;
    }
  },

  loadSellerStore: async () => {
    const { context, serverUser, sessionToken } = get();
    if (context !== 'seller' || !serverUser) return null;
    try {
      const stores = sessionToken
        ? await fetchStoresByOwnerUserRepo(serverUser.id)
        : await fetchStoresByOwnerTelegramRepo(serverUser.telegramUserId);
      const first = stores[0] ?? null;
      if (first) {
        get().resetCatalog();
        get().resetOrders();
        set({ storeId: first.id, currentStore: first });
        return first.id;
      }
      return null;
    } catch {
      return null;
    }
  },

  fetchCurrentStore: async () => {
    const { storeId } = get();
    if (!storeId) {
      set({ currentStore: null });
      return;
    }
    set({ authLoading: true, authError: null });
    try {
      set({ currentStore: await fetchStoreRepo(storeId), authLoading: false });
    } catch (e) {
      set({ authLoading: false, authError: (e as Error).message });
      throw e;
    }
  },

  uploadStoreBanner: async (file: File) => uploadFile(await compressImage(file, 1200, 0.8)),
});

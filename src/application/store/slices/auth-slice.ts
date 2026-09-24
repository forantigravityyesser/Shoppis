import type { StateCreator } from 'zustand';
import type { AppContext } from '../../../domain/constants/app-context';
import type { Store } from '../../../domain/models/store';
import {
  checkOwnership as checkOwnershipRepo,
  createStore as createStoreRepo,
  fetchStore as fetchStoreRepo,
  fetchStoresByOwner as fetchStoresByOwnerRepo,
  type CreateStoreInput,
} from '../../../infrastructure/repositories/store-repository';
import { insforge } from '../../../infrastructure/insforge/client';
import { createShopViaApi } from '../../../infrastructure/functions/shop-api';
import type { ServerUser } from '../../../infrastructure/functions/auth-api';
import { uploadFile } from '../../../infrastructure/storage/file-storage';
import { compressImage } from '../../../utils/image';
import { getStartParam, getTelegramUser, type TelegramUser } from '../../../infrastructure/telegram/telegram-app';
import type { RootStore } from '../index';

export interface AuthSlice {
  user: TelegramUser | null;
  /** Контекст входа: панель продавца или витрина. Не является ролью пользователя. 01 §5 */
  context: AppContext;
  /** Серверная сессия (HMAC), полученная после валидации initData. */
  sessionToken: string | null;
  /** Серверный User (внутренний id для приватных операций). */
  serverUser: ServerUser | null;
  /** Текущая витрина. Персистится — нет startParam = последний магазин. */
  storeId: string | null;
  /** Витрина продавца (для дашборда/онбординга) */
  currentStore: Store | null;
  authLoading: boolean;
  authError: string | null;
  /** Флаг первички как в старом useUIStore.isAppInitializing */
  isAppInitializing: boolean;
  setIsAppInitializing: (value: boolean) => void;
  initAuth: () => void;
  setUser: (user: TelegramUser | null) => void;
  /** Порт fetchUserProfile: подтянуть юзера из Telegram WebApp */
  fetchUserProfile: () => void;
  setContext: (context: AppContext) => void;
  setSession: (token: string | null, user?: ServerUser | null) => void;
  setStoreId: (storeId: string | null) => void;
  checkOwnership: () => Promise<boolean>;
  /**
   * Создание нового магазина.
   * 
   * Важный момент: вызывать ТОЛЬКО ПОСЛЕ useAppInit(),
   * когда user уже гарантированно установлен (setUser пользовался getTelegramUser()).
   * 
   * Принимает только данные формы (name, currency, language, bannerUrl).
   * telegramId берётся внутренним getTelegramUser(), чтобы избежать ошибки "not telegram user".
   */
  createStore: (input: Omit<CreateStoreInput, 'ownerTelegramId'>) => Promise<string>;
  /** Поиск витрин продавца при старте: есть — storeId + дашборд, нет — онбординг */
  loadSellerStore: () => Promise<string | null>;
  fetchCurrentStore: () => Promise<void>;
  /** Загрузка баннера в shoppis-media для формы онбординга */
  uploadStoreBanner: (file: File) => Promise<string>;
}

export const createAuthSlice: StateCreator<RootStore, [], [], AuthSlice> = (set, get) => ({
  user: null,
  context: 'buyer',
  sessionToken: null,
  serverUser: null,
  storeId: null,
  currentStore: null,
  authLoading: false,
  authError: null,
  isAppInitializing: true,
  setIsAppInitializing: (value) => set({ isAppInitializing: value }),

  fetchUserProfile: () => {
    const user = getTelegramUser();
    if (user) set({ user });
  },

  initAuth: () => {
    const user = getTelegramUser();
    const param = getStartParam();
    if (param === 'seller') {
      set({ user, context: 'seller', currentStore: null });
      return;
    }
    if (param.startsWith('store_')) {
      const storeId = param.replace(/^store_/, '');
      if (storeId) {
        get().resetCatalog();
        get().resetOrders();
        set({ user, context: 'buyer', storeId, currentStore: null });
        return;
      }
    }
    set({ user, context: 'buyer' });
  },

  setContext: (context) => set({ context }),

  setSession: (token, serverUser = null) => set({ sessionToken: token, serverUser }),

  setUser: (user) => set({ user }),

  setStoreId: (storeId) => {
    if (get().storeId === storeId) return;
    get().resetCatalog();
    get().resetOrders();
    set({ storeId, currentStore: null });
  },

  checkOwnership: async () => {
    const { storeId, user } = get();
    if (!storeId || !user) return false;
    try {
      return await checkOwnershipRepo(storeId, user.id);
    } catch {
      return false;
    }
  },

  createStore: async (input: Omit<CreateStoreInput, 'ownerTelegramId'>) => {
    const { user, sessionToken } = get();
    if (!input.name.trim()) throw new Error('Store name is required');

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
        // Fallback вне Telegram (локальная разработка) — legacy-путь.
        const telegramId =
          user && !user.id.startsWith('mock_')
            ? user.id
            : `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        store = await createStoreRepo({ ...input, name: input.name.trim(), ownerTelegramId: telegramId });

        if (telegramId.startsWith('temp_')) {
          get().resetCatalog();
          get().resetOrders();
          set({
            authError:
              'Магазин создан без привязки к Telegram. Чтобы сохранить его permanently, войдите через Telegram.',
            storeId: null,
            currentStore: null,
            authLoading: false,
            context: 'buyer',
          });
          try {
            await insforge.database.from('stores').delete().eq('id', store.id);
          } catch {}
          return store.id;
        }
      }

      get().resetCatalog();
      get().resetOrders();
      set({ storeId: store.id, currentStore: store, authLoading: false, context: 'seller' });

      const setDefaultRecipient = get()['setDefaultRecipient'];
      if (setDefaultRecipient) {
        setDefaultRecipient({ name: (user?.firstName || 'Пользователь'), phone: '', address: '' });
      }

      return store.id;
    } catch (e) {
      set({ authLoading: false, authError: (e as Error).message });
      throw e;
    }
  },

  loadSellerStore: async () => {
    const { context, user } = get();
    if (context !== 'seller' || !user) return null;
    try {
      const stores = await fetchStoresByOwnerRepo(user.id);
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
import type { StateCreator } from 'zustand';
import type { AppContext } from '../../../domain/constants/app-context';
import type { Store, StoreStatus } from '../../../domain/models/store';
import type { CreateStoreInput, StoreProfilePatch } from '../../contracts/store';
import type { ServerUser } from '../../contracts/auth';
import { deps } from '../../composition/container';
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
  /** Публичная витрина, которую просматривает покупатель (по public_id). */
  viewedStore: Store | null;
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
  /**
   * Публичный вход покупателя по `public_id` (deep link витрины). Резолвит
   * public_id → store, ставит storeId для каталога и viewedStore для отображения.
   * null — нет витрины (показываем «магазин не найден»).
   */
  loadBuyerStore: (publicId: string | null) => Promise<string | null>;
  fetchCurrentStore: () => Promise<void>;
  /**
   * Частичное обновление профиля витрины (persisted). Draft-состояние блока
   * живёт в UI; сюда приходит уже собранный patch конкретного блока. 12 §7.
   */
  updateStoreProfile: (patch: StoreProfilePatch) => Promise<void>;
  /** Операционная смена статуса витрины (ACTIVE ↔ PAUSED). */
  updateStoreStatus: (status: StoreStatus) => Promise<void>;
  /** Загрузка баннера в shoppis-media для формы онбординга */
  uploadStoreBanner: (file: File) => Promise<string>;
}

export const createAuthSlice: StateCreator<RootStore, [], [], AuthSlice> = (set, get) => ({
  serverUser: null,
  context: 'buyer',
  sessionToken: null,
  storeId: null,
  currentStore: null,
  viewedStore: null,
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
    get().resetCategories();
    get().resetOrders();
    set({ storeId, currentStore: null });
  },

  checkOwnership: async () => {
    const { storeId, serverUser, sessionToken } = get();
    if (!storeId || !serverUser) return false;
    try {
      return sessionToken
        ? await deps().storeRepository.checkOwnershipByUser(storeId, serverUser.id)
        : await deps().storeRepository.checkOwnershipByTelegram(storeId, serverUser.telegramUserId);
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
        store = await deps().shopApi.createShopViaApi(sessionToken, {
          name: input.name.trim(),
          currency: input.currency,
          language: input.language,
          bannerUrl: input.bannerUrl,
        });
      } else {
        // DEV-ONLY: локальное создание без серверной сессии (DEV_AUTH_MODE).
        store = await deps().storeRepository.createStore({
          ...input,
          name: input.name.trim(),
          ownerTelegramId: serverUser.telegramUserId,
        });
      }

      get().resetCatalog();
      get().resetCategories();
      get().resetOrders();
      set({ storeId: store.id, currentStore: store, authLoading: false, context: 'seller' });

      const setDefaultRecipient = get()['setDefaultRecipient'];
      if (setDefaultRecipient) {
        setDefaultRecipient({
          name: serverUser.firstName || 'Пользователь',
          phone: '',
          address: '',
        });
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
        ? await deps().storeRepository.fetchStoresByOwnerUser(serverUser.id)
        : await deps().storeRepository.fetchStoresByOwnerTelegram(serverUser.telegramUserId);
      const first = stores[0] ?? null;
      if (first) {
        get().resetCatalog();
        get().resetCategories();
        get().resetOrders();
        set({ storeId: first.id, currentStore: first });
        return first.id;
      }
      return null;
    } catch {
      return null;
    }
  },

  loadBuyerStore: async (publicId) => {
    if (!publicId) {
      get().resetCatalog();
      get().resetCategories();
      get().resetOrders();
      set({ viewedStore: null, storeId: null, authLoading: false });
      return null;
    }
    set({ authLoading: true, authError: null });
    try {
      // Канон — opaque public_id. Legacy-ссылки (`store_<internalId>`) резолвим
      // по внутреннему id как переходный путь.
      let store = await deps().storeRepository.fetchStoreByPublicId(publicId);
      if (!store) {
        try {
          store = await deps().storeRepository.fetchStore(publicId);
        } catch {
          store = null;
        }
      }
      if (!store) {
        set({ viewedStore: null, storeId: null, authLoading: false });
        return null;
      }
      get().resetCatalog();
      get().resetCategories();
      get().resetOrders();
      set({ viewedStore: store, storeId: store.id, authLoading: false });
      return store.id;
    } catch (e) {
      set({ authLoading: false, authError: (e as Error).message });
      throw e;
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
      set({ currentStore: await deps().storeRepository.fetchStore(storeId), authLoading: false });
    } catch (e) {
      set({ authLoading: false, authError: (e as Error).message });
      throw e;
    }
  },

  updateStoreProfile: async (patch) => {
    const { storeId, sessionToken } = get();
    if (!storeId) throw new Error('Store is not selected');
    const store = await deps().storeSettingsApi.updateProfile(sessionToken, storeId, patch);
    set({ currentStore: store });
  },

  updateStoreStatus: async (status) => {
    const { storeId, sessionToken } = get();
    if (!storeId) throw new Error('Store is not selected');
    const store = await deps().storeSettingsApi.updateStatus(sessionToken, storeId, status);
    set({ currentStore: store });
  },

  uploadStoreBanner: async (file: File) => deps().storage.uploadFile(await compressImage(file)),
});

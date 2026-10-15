import type { StateCreator } from 'zustand';
import type { AppContext } from '../../../domain/constants/app-context';
import type { Store, StoreStatus } from '../../../domain/models/store';
import type {
  CreateStoreInput,
  StoreProfilePatch,
  TutorialStatePatch,
} from '../../contracts/store';
import type { ServerUser } from '../../contracts/auth';
import type { PublicStoreContext } from '../../read-models/public-store';
import { deps } from '../../composition/container';
import { queryClient } from '../../queryClient';
import { clearOrderCache } from '../../orders/order-cache';
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
  /**
   * Публичный контекст витрины, которую просматривает покупатель. Минимальная
   * проекция (`PublicStoreContext`) — без owner/private-полей. docs/15 §4.
   */
  viewedStore: PublicStoreContext | null;
  /**
   * Куда вернуть «назад» из покупательского предпросмотра карточки товара,
   * открытого из seller-интерфейса (карточка товара продавца). `null` — не в
   * предпросмотре.
   */
  previewReturnPath: string | null;
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
  /**
   * Зафиксировать полученное согласие на Telegram-уведомления в текущей сессии.
   * Source of truth — сервер (`telegram_identities.notifications_enabled`); сюда
   * значение попадает после успешного write-access и persist в БД.
   */
  setNotificationsEnabled: (enabled: boolean) => void;
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
   * ссылку → минимальный `PublicStoreContext` (без owner/private-полей), ставит
   * `storeId` для scope и `viewedStore` для отображения. Legacy `store_<id>`
   * поддержан резолвером как временная совместимость. `null` — витрина не найдена
   * (показываем «магазин не найден»).
   */
  loadBuyerStore: (publicId: string | null) => Promise<string | null>;
  /**
   * Открыть покупательский предпросмотр витрины из seller-интерфейса: переводит
   * `context` в `buyer` и заполняет `viewedStore` проекцией `currentStore` (та же
   * витрина). Seller-состояние (`storeId`/`currentStore`/каталог) не сбрасывается —
   * в отличие от `loadBuyerStore`. `returnPath` — куда вернёт «назад».
   */
  enterStorePreview: (publicId: string, returnPath: string) => void;
  /** Выйти из покупательского предпросмотра: вернуть `context` в `seller`. */
  exitStorePreview: () => void;
  fetchCurrentStore: () => Promise<void>;
  /**
   * Частичное обновление профиля витрины (persisted). Draft-состояние блока
   * живёт в UI; сюда приходит уже собранный patch конкретного блока. 12 §7.
   */
  updateStoreProfile: (patch: StoreProfilePatch) => Promise<void>;
  /** Операционная смена статуса витрины (ACTIVE ↔ PAUSED). */
  updateStoreStatus: (status: StoreStatus) => Promise<void>;
  /**
   * Запись состояния обучения (docs/26 §3.6) — только на значимых переходах.
   * Сервер валидирует значения и инвариант; ответ — обновлённый магазин.
   */
  updateTutorialState: (patch: TutorialStatePatch) => Promise<void>;
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
  previewReturnPath: null,
  authLoading: false,
  authError: null,
  isAppInitializing: true,
  setIsAppInitializing: (value) => set({ isAppInitializing: value }),

  setContext: (context) => set({ context }),

  setSession: (token, user) => {
    // Смена личности → сбросить orders-кэш прошлого пользователя (docs/24 §3.4).
    if ((get().serverUser?.id ?? null) !== (user?.id ?? null)) {
      clearOrderCache(queryClient);
    }
    set({ sessionToken: token, serverUser: user });
  },

  clearSession: () => {
    clearOrderCache(queryClient);
    set({ sessionToken: null, serverUser: null });
  },

  setNotificationsEnabled: (enabled) =>
    set((s) =>
      s.serverUser ? { serverUser: { ...s.serverUser, notificationsEnabled: enabled } } : {},
    ),

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
      // У владельца нет магазина (в т.ч. удалён из БД): сбрасываем возможно
      // оставшийся в памяти storeId, чтобы роутер показал онбординг.
      get().resetCatalog();
      get().resetCategories();
      get().resetOrders();
      set({ storeId: null, currentStore: null });
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
      // Публичный resolver отдаёт только минимальную проекцию (без owner_* и
      // private seller data). Канон — opaque public_id; legacy `store_<id>`
      // резолвится внутри SQL как переходный путь (docs/15 §4.2-4.3).
      const store = await deps().storefrontRepository.loadPublicStoreContext(publicId);
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

  enterStorePreview: (publicId, returnPath) => {
    const store = get().currentStore;
    if (!store || store.publicId !== publicId) return;
    set({
      viewedStore: {
        id: store.id,
        publicId: store.publicId,
        name: store.name,
        status: store.status,
        supportHandle: store.supportHandle || null,
        logoUrl: store.logoUrl || null,
      },
      context: 'buyer',
      previewReturnPath: returnPath,
    });
  },

  exitStorePreview: () => {
    set({ context: 'seller', viewedStore: null, previewReturnPath: null });
  },

  fetchCurrentStore: async () => {
    const { storeId, sessionToken } = get();
    if (!storeId) {
      set({ currentStore: null });
      return;
    }
    set({ authLoading: true, authError: null });
    try {
      // С сессией — owner-scoped чтение через сервер (R1); без сессии (dev mock) —
      // прямой read. Возврат `null` — магазин недоступен, не сетевая ошибка.
      const store = sessionToken
        ? await deps().storeSettingsApi.readStore(sessionToken, storeId)
        : await deps().storeRepository.fetchStore(storeId);
      if (!store) {
        // Магазин удалён/недоступен — сбрасываем scope, роутер вернёт онбординг.
        get().resetCatalog();
        get().resetCategories();
        get().resetOrders();
        set({ storeId: null, currentStore: null, authLoading: false });
        return;
      }
      set({ currentStore: store, authLoading: false });
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

  updateTutorialState: async (patch) => {
    const { storeId, sessionToken } = get();
    if (!storeId) throw new Error('Store is not selected');
    const store = await deps().storeSettingsApi.updateTutorialState(sessionToken, storeId, patch);
    set({ currentStore: store });
  },

  uploadStoreBanner: async (file: File) => deps().imageUpload.uploadBannerImage(file),
});

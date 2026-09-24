import type { StateCreator } from 'zustand';
import type { UserRole } from '../../../domain/constants/roles';
import type { Store } from '../../../domain/models/store';
import {
  checkOwnership as checkOwnershipRepo,
  createStore as createStoreRepo,
  fetchStore as fetchStoreRepo,
  fetchStoresByOwner as fetchStoresByOwnerRepo,
  type CreateStoreInput,
} from '../../../infrastructure/repositories/store-repository';
import { insforge } from '../../../infrastructure/insforge/client';
import { uploadFile } from '../../../infrastructure/storage/file-storage';
import { compressImage } from '../../../utils/image';
import { getStartParam, getTelegramUser, type TelegramUser } from '../../../infrastructure/telegram/telegram-app';
import type { RootStore } from '../index';

export interface AuthSlice {
  user: TelegramUser | null;
  role: UserRole;
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
  setRole: (role: UserRole) => void;
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
  role: 'buyer',
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
      set({ user, role: 'seller', currentStore: null });
      return;
    }
    if (param.startsWith('store_')) {
      const storeId = param.replace(/^store_/, '');
      if (storeId) {
        get().resetCatalog();
        get().resetOrders();
        set({ user, role: 'buyer', storeId, currentStore: null });
        return;
      }
    }
    set({ user, role: 'buyer' });
  },

  setRole: (role) => set({ role }),

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
    // telegramId получаем внутри, так как useAppInit уже установил user к моменту вызова
    const { user } = get();

    let telegramId: string;
    if (user && !user.id.startsWith('mock_')) {
      // Реальный пользователь Telegram — используем его ID
      telegramId = user.id;
    } else {
      // Пользователь без Telegram (или режим разработки) — генерируем временный ID
      // Магазин создастся, а после можно связать с Telegram
      telegramId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    if (!input.name.trim()) throw new Error('Store name is required');

    set({ authLoading: true, authError: null });
    try {
      const store = await createStoreRepo({ ...input, name: input.name.trim(), ownerTelegramId: telegramId });
      // Автоматически устанавливаем состояние после создания
      get().resetCatalog();
      get().resetOrders();

      // Если магазин создавался без Telegram (временный ID) — не сохраняем состояние seller,
      // а показываем ошибку и возвращаемся на экран приветствия
      if (telegramId.startsWith('temp_')) {
        set({ authError: 'Магазин создан без привязки к Telegram. Чтобы сохранить его permanently, войдите через Telegram.', storeId: null, currentStore: null, authLoading: false, role: 'buyer' });
        // Удаляем временную витрину из базы, чтобы она "не сохранялась"
        try {
          await insforge.database.from('stores').delete().eq('id', store.id);
        } catch {}
        return store.id;
      }

      set({ storeId: store.id, currentStore: store, authLoading: false, role: 'seller' });

      // Синхронизируем покупателя ( создать строку customers + setDefaultRecipient )
      // useCustomerSync сработает при следующем storeId change, но можно и тут:
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
    const { role, user } = get();
    if (role !== 'seller' || !user) return null;
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
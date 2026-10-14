import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RootStore } from './index';
import { createAuthSlice } from './slices/auth-slice';
import { createCartSlice } from './slices/cart-slice';
import { createCategorySlice } from './slices/category-slice';
import { createFavoritesSlice } from './slices/favorites-slice';
import { createOrderSlice } from './slices/order-slice';
import { createProductSlice } from './slices/product-slice';
import { createSettingsSlice } from './slices/settings-slice';
import { createUiSlice } from './slices/ui-slice';

export const useStore = create<RootStore>()(
  persist(
    (...args) => ({
      ...createAuthSlice(...args),
      ...createProductSlice(...args),
      ...createCategorySlice(...args),
      ...createCartSlice(...args),
      ...createFavoritesSlice(...args),
      ...createOrderSlice(...args),
      ...createSettingsSlice(...args),
      ...createUiSlice(...args),
    }),
    {
      name: 'tg-marketplace-storage',
      // v0 persistил согласие на уведомления в `userSettings`; теперь это серверный
      // факт (`ServerUser.notificationsEnabled`), поэтому чистим устаревшие ключи,
      // иначе залипшее `notifications: true` переживает сброс флага в БД.
      version: 1,
      migrate: (persisted) => {
        const state = persisted as { userSettings?: Record<string, unknown> } | undefined;
        if (state?.userSettings) {
          delete state.userSettings.notifications;
          delete state.userSettings.notificationsPrompted;
        }
        return state as unknown as RootStore;
      },
      // storeId НЕ персистим: он выводится при старте (продавец — по владельцу,
      // покупатель — по last_visited_store_public_id). Иначе id удалённого из БД
      // магазина остаётся в localStorage и роутер минует онбординг. 01 §5
      partialize: (s) => ({
        cartByStore: s.cartByStore,
        favoritesByStore: s.favoritesByStore,
        userSettings: s.userSettings,
        defaultRecipient: s.defaultRecipient,
      }),
    },
  ),
);

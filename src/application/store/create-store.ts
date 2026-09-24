import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RootStore } from './index';
import { createAuthSlice } from './slices/auth-slice';
import { createCartSlice } from './slices/cart-slice';
import { createCategorySlice } from './slices/category-slice';
import { createFavoritesSlice } from './slices/favorites-slice';
import { createOrderSlice } from './slices/order-slice';
import { createProductSlice } from './slices/product-slice';
import { createReviewSlice } from './slices/review-slice';
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
      ...createReviewSlice(...args),
      ...createUiSlice(...args),
    }),
    {
      name: 'tg-marketplace-storage',
      partialize: (s) => ({
        cartByStore: s.cartByStore,
        favoritesByStore: s.favoritesByStore,
        role: s.role,
        storeId: s.storeId,
        userSettings: s.userSettings,
        defaultRecipient: s.defaultRecipient,
      }),
    },
  ),
);

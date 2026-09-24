import type { StateCreator } from 'zustand';
import type { RootStore } from '../index';

export interface FavoritesSlice {
  /** Изоляция избранного: своё в каждой витрине */
  favoritesByStore: Record<string, string[]>;
  toggleFavorite: (productId: string) => void;
}

export const createFavoritesSlice: StateCreator<RootStore, [], [], FavoritesSlice> = (set, get) => ({
  favoritesByStore: {},

  toggleFavorite: (productId) => {
    const { storeId } = get();
    if (!storeId) return;
    set((s) => {
      const current = s.favoritesByStore[storeId] ?? [];
      const next = current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId];
      return { favoritesByStore: { ...s.favoritesByStore, [storeId]: next } };
    });
  },
});

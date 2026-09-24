import { useStore } from '../store';

export function useFavorites() {
  const storeId = useStore((s) => s.storeId);
  const favoritesByStore = useStore((s) => s.favoritesByStore);
  const toggleFavorite = useStore((s) => s.toggleFavorite);

  const ids = (storeId && favoritesByStore[storeId]) || [];
  return {
    ids,
    count: ids.length,
    isFavorite: (productId: string) => ids.includes(productId),
    toggleFavorite,
  };
}

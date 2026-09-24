import type { AuthSlice } from './slices/auth-slice';
import type { CartSlice } from './slices/cart-slice';
import type { CategorySlice } from './slices/category-slice';
import type { FavoritesSlice } from './slices/favorites-slice';
import type { OrderSlice } from './slices/order-slice';
import type { ProductSlice } from './slices/product-slice';
import type { ReviewSlice } from './slices/review-slice';
import type { SettingsSlice } from './slices/settings-slice';
import type { UiSlice } from './slices/ui-slice';

export interface RootStore
  extends AuthSlice,
    ProductSlice,
    CategorySlice,
    CartSlice,
    FavoritesSlice,
    OrderSlice,
    SettingsSlice,
    ReviewSlice,
    UiSlice {}

export { useStore } from './create-store';

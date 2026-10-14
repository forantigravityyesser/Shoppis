import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useStore } from './application/store';
import BuyerLayout from './presentation/layouts/BuyerLayout';
import SellerLayout from './presentation/layouts/SellerLayout';
import NavigationHistoryTracker from './presentation/shared/components/NavigationHistoryTracker';
// Каталог — не lazy: автофокус поля поиска (Home → Каталог) требует, чтобы экран
// отрендерился синхронно внутри тапа (иначе в WebView не открывается клавиатура).
import CatalogView from './presentation/buyer/views/CatalogView';

const HomeView = lazy(() => import('./presentation/buyer/views/HomeView'));
const DetailsView = lazy(() => import('./presentation/buyer/views/DetailsView'));
const CartView = lazy(() => import('./presentation/buyer/views/CartView'));
const FavoritesView = lazy(() => import('./presentation/buyer/views/FavoritesView'));
const OrdersView = lazy(() => import('./presentation/buyer/views/OrdersView'));
const OrderDetailsView = lazy(() => import('./presentation/buyer/views/OrderDetailsView'));
const AccountView = lazy(() => import('./presentation/buyer/views/AccountView'));
const ProductAbout = lazy(() => import('./presentation/buyer/views/product/ProductAbout'));
const StorefrontProductReviewsView = lazy(
  () => import('./presentation/buyer/views/product/ProductReviewsView'),
);
const StorefrontProductQuestionsView = lazy(
  () => import('./presentation/buyer/views/product/ProductQuestionsView'),
);
const StorefrontProductRelatedView = lazy(
  () => import('./presentation/buyer/views/product/ProductRelated'),
);

const SellerDashboard = lazy(() => import('./presentation/seller/views/SellerDashboard'));
const SellerSalesView = lazy(() => import('./presentation/seller/views/SellerSalesView'));
const InventoryView = lazy(() => import('./presentation/seller/views/InventoryView'));
const CategoryView = lazy(() => import('./presentation/seller/views/CategoryView'));
const ProductView = lazy(() => import('./presentation/seller/views/ProductView'));
const ProductOverview = lazy(
  () => import('./presentation/seller/inventory/product/ProductOverview'),
);
const ProductReviewsView = lazy(() => import('./presentation/seller/views/ProductReviewsView'));
const ProductQuestionsView = lazy(() => import('./presentation/seller/views/ProductQuestionsView'));
const ProductPreviewView = lazy(() => import('./presentation/seller/views/ProductPreviewView'));
const EditProductView = lazy(() => import('./presentation/seller/views/EditProductView'));
const CreateProductView = lazy(() => import('./presentation/seller/views/CreateProductView'));
const CreateCategoryView = lazy(() => import('./presentation/seller/views/CreateCategoryView'));
const SellerOrdersView = lazy(() => import('./presentation/seller/views/SellerOrdersView'));
const SellerOrderDetailsView = lazy(
  () => import('./presentation/seller/views/SellerOrderDetailsView'),
);
const SellerSettingsView = lazy(() => import('./presentation/seller/views/SellerSettingsView'));
const SettingsProfileView = lazy(() => import('./presentation/seller/views/SettingsProfileView'));
const SettingsLocalizationView = lazy(
  () => import('./presentation/seller/views/SettingsLocalizationView'),
);
const SettingsContactView = lazy(() => import('./presentation/seller/views/SettingsContactView'));
const SettingsShareView = lazy(() => import('./presentation/seller/views/SettingsShareView'));
const SellerOnboardingView = lazy(() => import('./presentation/seller/views/SellerOnboardingView'));

/** Порт router.jsx: ветки buyer/seller с гардами по storeId */
export default function AppRouter() {
  const context = useStore((s) => s.context);
  const storeId = useStore((s) => s.storeId);

  if (context === 'seller') {
    return (
      <>
        <NavigationHistoryTracker />
        <Routes>
          <Route element={<SellerLayout />}>
            <Route
              path="/seller"
              element={
                !storeId ? <SellerOnboardingView /> : <Navigate to="/seller/dashboard" replace />
              }
            />
            <Route
              path="/seller/dashboard"
              element={storeId ? <SellerDashboard /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/sales"
              element={storeId ? <SellerSalesView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/inventory"
              element={storeId ? <InventoryView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/inventory/category/new"
              element={storeId ? <CreateCategoryView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/inventory/category/:categoryId"
              element={storeId ? <CategoryView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/inventory/product/new"
              element={storeId ? <CreateProductView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/inventory/product/:productId"
              element={storeId ? <ProductView /> : <Navigate to="/seller" replace />}
            >
              <Route index element={<ProductOverview />} />
              <Route path="reviews" element={<ProductReviewsView />} />
              <Route path="questions" element={<ProductQuestionsView />} />
              <Route path="preview" element={<ProductPreviewView />} />
            </Route>
            <Route
              path="/seller/inventory/product/:productId/edit"
              element={storeId ? <EditProductView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/orders"
              element={storeId ? <SellerOrdersView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/orders/:orderId"
              element={storeId ? <SellerOrderDetailsView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/orders/history"
              element={
                storeId ? (
                  <Navigate to="/seller/orders?status=history" replace />
                ) : (
                  <Navigate to="/seller" replace />
                )
              }
            />
            <Route
              path="/seller/settings"
              element={storeId ? <SellerSettingsView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/settings/profile"
              element={storeId ? <SettingsProfileView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/settings/localization"
              element={storeId ? <SettingsLocalizationView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/settings/contact"
              element={storeId ? <SettingsContactView /> : <Navigate to="/seller" replace />}
            />
            <Route
              path="/seller/settings/share"
              element={storeId ? <SettingsShareView /> : <Navigate to="/seller" replace />}
            />
            <Route path="*" element={<Navigate to="/seller" replace />} />
          </Route>
        </Routes>
      </>
    );
  }

  return (
    <>
      <NavigationHistoryTracker />
      <Routes>
        <Route element={<BuyerLayout />}>
          <Route path="/" element={<HomeView />} />
          <Route path="/catalog" element={<CatalogView />} />
          <Route path="/cart" element={<CartView />} />
          <Route path="/favorites" element={<FavoritesView />} />
          <Route path="/orders" element={<OrdersView />} />
          <Route path="/orders/:orderId" element={<OrderDetailsView />} />
          <Route path="/account" element={<AccountView />} />
          <Route path="/product/:id" element={<DetailsView />}>
            <Route index element={<ProductAbout />} />
            <Route path="reviews" element={<StorefrontProductReviewsView />} />
            <Route path="questions" element={<StorefrontProductQuestionsView />} />
            <Route path="related" element={<StorefrontProductRelatedView />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

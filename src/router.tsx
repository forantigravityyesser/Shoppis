import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useStore } from './application/store';
import BuyerLayout from './presentation/layouts/BuyerLayout';
import SellerLayout from './presentation/layouts/SellerLayout';

const HomeView = lazy(() => import('./presentation/buyer/views/HomeView'));
const DetailsView = lazy(() => import('./presentation/buyer/views/DetailsView'));
const CartView = lazy(() => import('./presentation/buyer/views/CartView'));
const FavoritesView = lazy(() => import('./presentation/buyer/views/FavoritesView'));
const OrdersView = lazy(() => import('./presentation/buyer/views/OrdersView'));
const AccountView = lazy(() => import('./presentation/buyer/views/AccountView'));

const SellerDashboard = lazy(() => import('./presentation/seller/views/SellerDashboard'));
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
const SellerOrdersHistoryView = lazy(
  () => import('./presentation/seller/views/SellerOrdersHistoryView'),
);
const SellerSettingsView = lazy(() => import('./presentation/seller/views/SellerSettingsView'));
const SellerOnboardingView = lazy(() => import('./presentation/seller/views/SellerOnboardingView'));

/** Порт router.jsx: ветки buyer/seller с гардами по storeId */
export default function AppRouter() {
  const context = useStore((s) => s.context);
  const storeId = useStore((s) => s.storeId);

  if (context === 'seller') {
    return (
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
            path="/seller/orders/history"
            element={storeId ? <SellerOrdersHistoryView /> : <Navigate to="/seller" replace />}
          />
          <Route
            path="/seller/settings"
            element={storeId ? <SellerSettingsView /> : <Navigate to="/seller" replace />}
          />
          <Route path="*" element={<Navigate to="/seller" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<BuyerLayout />}>
        <Route path="/" element={<HomeView />} />
        <Route path="/cart" element={<CartView />} />
        <Route path="/favorites" element={<FavoritesView />} />
        <Route path="/orders" element={<OrdersView />} />
        <Route path="/account" element={<AccountView />} />
        <Route path="/product/:id" element={<DetailsView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

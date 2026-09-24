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
const OrderDetailView = lazy(() => import('./presentation/buyer/views/OrderDetailView'));
const AccountView = lazy(() => import('./presentation/buyer/views/AccountView'));

const SellerDashboard = lazy(() => import('./presentation/seller/views/SellerDashboard'));
const InventoryView = lazy(() => import('./presentation/seller/views/InventoryView'));
const SellerOrdersView = lazy(() => import('./presentation/seller/views/SellerOrdersView'));
const SellerManagementView = lazy(() => import('./presentation/seller/views/SellerManagementView'));
const SellerOnboardingView = lazy(() => import('./presentation/seller/views/SellerOnboardingView'));

/** Порт router.jsx: ветки buyer/seller с гардами по storeId */
export default function AppRouter() {
  const role = useStore((s) => s.role);
  const storeId = useStore((s) => s.storeId);

  if (role === 'seller') {
    return (
      <Routes>
        <Route element={<SellerLayout />}>
          <Route path="/seller" element={!storeId ? <SellerOnboardingView /> : <Navigate to="/seller/dashboard" replace />} />
          <Route path="/seller/dashboard" element={storeId ? <SellerDashboard /> : <Navigate to="/seller" replace />} />
          <Route path="/seller/inventory" element={storeId ? <InventoryView /> : <Navigate to="/seller" replace />} />
          <Route path="/seller/orders" element={storeId ? <SellerOrdersView /> : <Navigate to="/seller" replace />} />
          <Route path="/seller/management" element={storeId ? <SellerManagementView /> : <Navigate to="/seller" replace />} />
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

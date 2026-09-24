import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { useStore } from '../../application/store';
import SellerNavBar from '../seller/components/SellerNavBar';

/**
 * Seller App Shell: flex-колонка.
 * Контент скроллится внутри, навбар — flex-элемент снизу (не перекрывает контент).
 * Навбар показывается только при наличии магазина (онбординг — без навигации).
 */
export default function SellerLayout() {
  const storeId = useStore((s) => s.storeId);
  return (
    <div className="app-shell">
      <div className="scrollable-content">
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>}>
          <Outlet />
        </Suspense>
      </div>
      {storeId && <SellerNavBar />}
    </div>
  );
}

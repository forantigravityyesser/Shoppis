import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { useStore } from '../../application/store';
import SellerNavBar from '../shared/components/SellerNavBar';

/** Порт SellerLayout: контент + нижний навбар только при наличии магазина */
export default function SellerLayout() {
  const storeId = useStore((s) => s.storeId);
  return (
    <>
      <div className="scrollable-content">
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>}>
          <Outlet />
        </Suspense>
      </div>
      {storeId && (
        <div className="flex-shrink-0">
          <SellerNavBar />
        </div>
      )}
    </>
  );
}

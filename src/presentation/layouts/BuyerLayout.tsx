import { Suspense } from 'react';
import { Outlet } from 'react-router';
import FloatingNavBar from '../shared/components/FloatingNavBar';

/** Порт BuyerLayout: контент + нижний навбар покупателя */
export default function BuyerLayout() {
  return (
    <>
      <div className="scrollable-content">
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>}>
          <Outlet />
        </Suspense>
      </div>
      <div className="flex-shrink-0">
        <FloatingNavBar />
      </div>
    </>
  );
}

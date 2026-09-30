import { Suspense, useRef } from 'react';
import { Outlet } from 'react-router';
import { useStore } from '../../application/store';
import SellerNavBar from '../seller/components/SellerNavBar';
import { useScrollToTop } from '../shared/hooks/useScrollToTop';

/**
 * Seller App Shell: flex-колонка.
 * Контент скроллится внутри, навбар — flex-элемент снизу (не перекрывает контент).
 * Навбар показывается только при наличии магазина (онбординг — без навигации).
 * При смене вкладки контент открывается с начала (useScrollToTop).
 */
export default function SellerLayout() {
  const storeId = useStore((s) => s.storeId);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollToTop(scrollRef);

  return (
    <div className="app-shell">
      <div className="scrollable-content" ref={scrollRef}>
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>}>
          <Outlet />
        </Suspense>
      </div>
      {storeId && <SellerNavBar />}
    </div>
  );
}

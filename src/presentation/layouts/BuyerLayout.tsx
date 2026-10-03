import { Suspense, useRef } from 'react';
import { Outlet } from 'react-router';
import FloatingNavBar from '../shared/components/FloatingNavBar';
import { useScrollToTop } from '../shared/hooks/useScrollToTop';

/**
 * Buyer App Shell: flex-колонка с брендовым фоном (`--color-bg-app`).
 * Контент скроллится внутри, нижний навбар — flex-элемент снизу (не перекрывает
 * контент). Смена вкладки открывает контент с начала (useScrollToTop).
 */
export default function BuyerLayout() {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollToTop(scrollRef);

  return (
    <div className="app-shell app-shell--buyer">
      <div className="scrollable-content" ref={scrollRef}>
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>}>
          <Outlet />
        </Suspense>
      </div>
      <FloatingNavBar />
    </div>
  );
}

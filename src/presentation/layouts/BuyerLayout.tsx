import { Suspense, useRef } from 'react';
import { Outlet } from 'react-router';
import FloatingNavBar from '../shared/components/FloatingNavBar';
import { useScrollToTop } from '../shared/hooks/useScrollToTop';

/** Порт BuyerLayout: контент + нижний навбар покупателя. Смена вкладки — скролл в начало. */
export default function BuyerLayout() {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollToTop(scrollRef);

  return (
    <>
      <div className="scrollable-content" ref={scrollRef}>
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

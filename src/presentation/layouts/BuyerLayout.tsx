import { Suspense, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import FloatingNavBar from '../shared/components/FloatingNavBar';
import ScreenLoader from '../shared/components/ScreenLoader';
import Toast from '../shared/components/Toast';
import FlyingAnimations from '../shared/components/FlyingAnimations';
import { useScrollToTop } from '../shared/hooks/useScrollToTop';

/**
 * Buyer App Shell: flex-колонка с брендовым фоном (`--color-bg-app`).
 * Контент скроллится внутри, нижний навбар — flex-элемент снизу (не перекрывает
 * контент). Смена вкладки открывает контент с начала (useScrollToTop).
 *
 * Product Detail (`/product/*`) — immersive-режим: глобальный навбар скрыт,
 * его роль выполняет собственная нижняя CTA карточки (docs/14 §3.2).
 */
export default function BuyerLayout() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useScrollToTop(scrollRef);

  const immersive = pathname.startsWith('/product/');

  return (
    <div className={`app-shell app-shell--buyer${immersive ? ' app-shell--immersive' : ''}`}>
      <div className="scrollable-content" ref={scrollRef}>
        <Suspense fallback={<ScreenLoader />}>
          <Outlet />
        </Suspense>
      </div>
      {!immersive && <FloatingNavBar />}
      <Toast />
      <FlyingAnimations />
    </div>
  );
}

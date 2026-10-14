import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { getNavigationDepth, setNavigationDepth } from '../can-go-back';

/**
 * Считает глубину истории для `MemoryRouter` (который не пишет в `window.history`):
 * PUSH увеличивает, POP уменьшает, REPLACE не меняет глубину. Сравнение `location.key`
 * гарантирует ровно одно изменение счётчика на переход (в т.ч. при двойном прогоне
 * эффекта в StrictMode).
 *
 * Ничего не рендерит; монтируется один раз в роутере (синхронно с ветками buyer/seller).
 */
export default function NavigationHistoryTracker(): null {
  const location = useLocation();
  const navigationType = useNavigationType();
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Первый коммит — это точка входа (POP), истории ещё нет.
    if (lastKeyRef.current === null) {
      lastKeyRef.current = location.key;
      return;
    }
    if (lastKeyRef.current === location.key) return;
    lastKeyRef.current = location.key;

    if (navigationType === 'PUSH') {
      setNavigationDepth(getNavigationDepth() + 1);
    } else if (navigationType === 'POP') {
      setNavigationDepth(getNavigationDepth() - 1);
    }
  }, [location.key, navigationType]);

  return null;
}

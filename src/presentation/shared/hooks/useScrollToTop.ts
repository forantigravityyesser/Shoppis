import { useEffect, type RefObject } from 'react';
import { useLocation } from 'react-router';

/**
 * Сбрасывает скролл контейнера в начало при смене маршрута, чтобы новая
 * вкладка/экран открывались сверху независимо от предыдущей позиции.
 */
export function useScrollToTop<T extends HTMLElement>(ref: RefObject<T>): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }, [pathname, ref]);
}

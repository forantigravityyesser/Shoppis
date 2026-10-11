import { useLayoutEffect, type RefObject } from 'react';
import { useLocation } from 'react-router';

/**
 * Сбрасывает скролл контейнера в начало при смене маршрута: любая новая
 * вкладка/экран (вперёд или назад) открывается сверху, позиция скролла с
 * предыдущего экрана не переносится.
 *
 * Сброс повторяется на следующем кадре: браузерная history-реставрация скролла
 * может прийти уже после коммита и «вернуть» прежнюю позицию (тогда как
 * `scrollRestoration = 'manual'` в main). Двойной сброс гарантирует верх.
 */
export function useScrollToTop<T extends HTMLElement>(ref: RefObject<T>): void {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const reset = () => {
      const el = ref.current;
      if (!el) return;
      // Сброс до отрисовки (useLayoutEffect): нового экрана не должно быть видно со
      // старым скроллом. `overflow-anchor: none` на `.scrollable-content` не даёт
      // браузеру «заякорить» и вернуть прежнюю позицию при подмене контента.
      el.scrollTop = 0;
      el.scrollLeft = 0;
    };

    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [pathname, ref]);
}

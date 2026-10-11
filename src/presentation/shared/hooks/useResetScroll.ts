import { useLayoutEffect, type RefObject } from 'react';

/**
 * Гарантирует, что экран-деталь открывается сверху: сбрасывает ближайший контейнер
 * скролла (`.scrollable-content`) при монтировании и при смене `dep` (напр. id сущности).
 *
 * Дополняет `useScrollToTop` уровня layout: если контент дорастает после навигации
 * (lazy/Suspense, догрузка данных), сброс повторяется, когда сущность уже доступна, —
 * позиция скролла с предыдущей вкладки не переносится.
 */
export function useResetScroll<T extends HTMLElement>(ref: RefObject<T>, dep?: unknown): void {
  useLayoutEffect(() => {
    const scroller = ref.current?.closest('.scrollable-content') as HTMLElement | null;
    if (!scroller) return;
    scroller.scrollTop = 0;
    scroller.scrollLeft = 0;
  }, [ref, dep]);
}

import { useEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router';

const LAYER_PATH = /\/(reviews|questions)\/?$/;

/** База карточки товара: `/product/<id>` или null. */
function productBase(pathname: string): string | null {
  const match = /^(\/product\/[^/]+)/.exec(pathname);
  return match ? match[1] : null;
}

/** Маршрут-слой карточки (Отзывы/Вопросы) — поверх shell, без смены контента. */
function isLayerPath(pathname: string): boolean {
  return LAYER_PATH.test(pathname);
}

/**
 * Сбрасывает скролл контейнера в начало при смене маршрута, чтобы новая
 * вкладка/экран открывались сверху независимо от предыдущей позиции.
 *
 * Исключение (docs/14 §3.3, §16): переход к слою «Отзывы/Вопросы» и обратно
 * внутри одной карточки товара не сбрасывает скролл — позиция shell сохраняется.
 */
export function useScrollToTop<T extends HTMLElement>(ref: RefObject<T>): void {
  const { pathname } = useLocation();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    const prev = prevPathname.current;
    prevPathname.current = pathname;

    const sameProduct = productBase(prev) !== null && productBase(prev) === productBase(pathname);
    if (sameProduct && (isLayerPath(prev) || isLayerPath(pathname))) return;

    const el = ref.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }, [pathname, ref]);
}

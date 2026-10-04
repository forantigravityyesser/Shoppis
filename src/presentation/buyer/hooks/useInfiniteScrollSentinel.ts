import { useEffect, useRef } from 'react';

interface Options {
  /** Вызывается, когда sentinel приблизился к viewport. Должен быть стабильным. */
  onLoadMore: () => void;
  /** false — observer не создаётся (нет следующей страницы или уже идёт загрузка). */
  enabled: boolean;
  /** Запас до появления sentinel в viewport (prefetch). docs/15 §5.4. */
  rootMargin?: string;
}

/**
 * Sentinel конце товарного потока: `IntersectionObserver` (без scroll-listener)
 * вызывает `onLoadMore`, когда пользователь приближается к концу. При смене
 * `enabled` observer пересоздаётся — это даёт цепочку «догрузил → ещё видно →
 * догрузил», пока контент не отодвинет sentinel (не более одной страницы за раз
 * за счёт in-flight-защиты в `useStorefrontHomeProducts`). docs/15 §5.4-5.5.
 */
export function useInfiniteScrollSentinel({ onLoadMore, enabled, rootMargin = '600px' }: Options) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { root: null, rootMargin, threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, rootMargin]);

  return ref;
}

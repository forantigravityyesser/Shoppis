import { useEffect, useState, type RefObject } from 'react';

/**
 * Сообщает, что привязанный элемент (шапка/заголовок секции) уехал из видимой
 * области при скролле — тогда залипающие кнопки-дублёры в углах «плавают» и
 * становятся прозрачнее. Следим через `IntersectionObserver`, без обработчиков
 * скролла (docs/14 §3.3). Если API недоступен — считаем, что не залипли.
 */
export function useStuck<T extends HTMLElement>(ref: RefObject<T>): boolean {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return stuck;
}

import type { ReactNode } from 'react';
import { useImageFallback } from '../hooks/useImageFallback';

interface Props {
  src: string | null;
  alt: string;
  className?: string;
  /** Заглушка при отсутствии (`null`) или сбое загрузки (`404`/broken) изображения. */
  fallback: ReactNode;
  /** Карточки/категории — `lazy`; главный visual Home (баннер) — `eager`. */
  loading?: 'lazy' | 'eager';
}

/**
 * Единый стандарт изображения покупателя (docs/15 §7.3):
 *   `null` URL / broken URL → `fallback`; slow → контейнер-заглушка виден до
 *   декодирования; success → изображение. Никаких бесконечных повторов: при
 *   ошибке `<img>` размонтируется, `useImageFallback` сбрасывается при смене `src`.
 * Размеры задаются CSS (aspect-ratio/фикс. размеры), поэтому layout shift нет.
 */
export default function SafeImage({ src, alt, className, fallback, loading = 'lazy' }: Props) {
  const { failed, onError } = useImageFallback(src);

  if (!src || failed) return <>{fallback}</>;

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={onError}
    />
  );
}

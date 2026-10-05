import { useState } from 'react';

/**
 * Фолбэк при сбое загрузки изображения: если картинка по `src` не загрузилась,
 * компонент показывает заглушку. Смена `src` автоматически сбрасывает флаг
 * (без setState в эффекте). docs/13 §24.
 */
export function useImageFallback(src: string | null): { failed: boolean; onError: () => void } {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return {
    failed: src != null && failedSrc === src,
    onError: () => setFailedSrc(src),
  };
}

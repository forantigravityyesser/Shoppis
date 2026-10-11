import { useEffect, useState } from 'react';
import { deps } from '../composition/container';
import type { ViewportSnapshot } from '../ports/telegram';

/**
 * Реактивный снимок viewport (fullscreen + safe-area инсеты + высоты).
 * Отладочный инструмент: подписывается на изменения платформы Telegram.
 */
export function useViewportSnapshot(): ViewportSnapshot {
  const [snapshot, setSnapshot] = useState<ViewportSnapshot>(() =>
    deps().telegram.getViewportSnapshot(),
  );

  useEffect(
    () =>
      deps().telegram.subscribeViewport(() => {
        setSnapshot(deps().telegram.getViewportSnapshot());
      }),
    [],
  );

  return snapshot;
}

import { useCallback, useRef, useState } from 'react';
import { useInventoryActions } from './useInventoryActions';

export interface CategoryReorderController {
  /** Идёт отправка — контролы должны быть disabled, sheet не закрывать. */
  pending: boolean;
  /** Ошибка последней попытки; сбрасывается на новый заход/reset. */
  error: string | null;
  /** Сбросить ошибку (например, при открытии sheet). */
  reset: () => void;
  /** Переставить категорию; true — успех, ошибка кладётся в `error`. */
  reorder: (id: string, position: number) => Promise<boolean>;
}

/**
 * Общий mutation-lifecycle реордера категории (docs/19 §10, §33):
 * IDLE → SUBMITTING → SUCCESS | ERROR, защита от дублей, ошибка для retry.
 * Используется InventoryView (бейдж) и EditCategorySheet («Изменить порядок»).
 */
export function useCategoryReorder(): CategoryReorderController {
  const { reorderCategory } = useInventoryActions();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guard = useRef(false);

  const reorder = useCallback(
    async (id: string, position: number): Promise<boolean> => {
      if (guard.current) return false;
      guard.current = true;
      setPending(true);
      setError(null);
      try {
        const ok = await reorderCategory(id, position);
        if (!ok) {
          setError('Не удалось изменить порядок. Попробуйте ещё раз.');
          return false;
        }
        return true;
      } finally {
        guard.current = false;
        setPending(false);
      }
    },
    [reorderCategory],
  );

  const reset = useCallback(() => setError(null), []);

  return { pending, error, reset, reorder };
}

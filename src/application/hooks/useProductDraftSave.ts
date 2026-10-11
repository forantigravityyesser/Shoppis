import { useCallback } from 'react';
import type { ProductFormPayload } from '../read-models/inventory-view';
import type { DraftMode } from '../rules/product-draft-session';

/** Минимум состояния черновика, нужный для маршрутизации сохранения. */
export interface SavableDraft {
  localId: string;
  mode: DraftMode;
  productId: string | null;
}

export interface UseProductDraftSaveParams {
  activeDraft: SavableDraft | null;
  createProduct: (payload: ProductFormPayload) => Promise<string>;
  updateProduct: (productId: string, payload: ProductFormPayload) => Promise<void>;
  /** Убирает карточку из сессии после успешного сохранения (docs/23 §7.3). */
  complete: (localId: string) => void;
  setSaving: (localId: string, saving: boolean) => void;
  setError: (localId: string, error: string | null) => void;
}

/**
 * Маршрутизация сохранения активного черновика (docs/23 §3.2, §10, §13.5):
 * - edit-карточка (исходный товар или уже сохранённая копия) → **update**;
 * - новая копия (create без productId) → **create**.
 *
 * После **успеха** карточка уходит из сессии (`complete`): её данные уже в БД, повторно сохранять
 * локальный черновик нечего (docs/23 §7.3). Независимое сохранение (docs/23 §12): статус
 * (`saving`/`error`) пишется в конкретный черновик по `localId`, поэтому ошибка одной карточки не
 * затрагивает остальные, а результат привязывается к правильной карточке даже при переключении.
 */
export function useProductDraftSave(params: UseProductDraftSaveParams) {
  const { activeDraft, createProduct, updateProduct, complete, setSaving, setError } = params;

  return useCallback(
    async (payload: ProductFormPayload): Promise<void> => {
      const draft = activeDraft;
      if (!draft) return;
      setSaving(draft.localId, true);
      setError(draft.localId, null);
      try {
        if (draft.mode === 'edit' && draft.productId) {
          await updateProduct(draft.productId, payload);
        } else {
          await createProduct(payload);
        }
        complete(draft.localId);
      } catch (e) {
        setError(
          draft.localId,
          e instanceof Error && e.message
            ? e.message
            : 'Не удалось сохранить товар. Попробуйте ещё раз.',
        );
        throw e;
      }
    },
    [activeDraft, createProduct, updateProduct, complete, setSaving, setError],
  );
}

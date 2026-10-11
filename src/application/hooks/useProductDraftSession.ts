import { useCallback, useState } from 'react';
import {
  activeDraft as selectActiveDraft,
  canAddDraft,
  completeDraft,
  copyActiveDraft,
  createDraft,
  hasUnsavedChanges,
  markDraftSaved,
  removeDraft,
  setActiveDraft,
  setDraftError,
  setDraftSaving,
  startSession,
  updateDraftValues,
  type DraftMode,
  type ProductDraft,
  type ProductDraftSession,
} from '../rules/product-draft-session';

/**
 * React-адаптер над чистой моделью сессии черновиков (docs/23 §13.2, решение Q5).
 * Держит сессию в локальном `useState` (это UI-состояние, не server-state и не глобальный store),
 * а логику делегирует функциям `product-draft-session`. Хук не знает про конкретный тип значений.
 */
export interface UseProductDraftSessionConfig<TValues> {
  initialValues: TValues;
  mode?: DraftMode;
  productId?: string | null;
  /** Функция подготовки копии (обычно `createProductCopy`). */
  copyValues: (values: TValues) => TValues;
}

export interface UseProductDraftSessionResult<TValues> {
  drafts: ProductDraft<TValues>[];
  activeDraft: ProductDraft<TValues> | null;
  canAdd: boolean;
  hasUnsaved: boolean;
  addCopy: () => void;
  selectDraft: (localId: string) => void;
  remove: (localId: string) => void;
  /** Убирает карточку из сессии после успешного сохранения. */
  complete: (localId: string) => void;
  updateValues: (values: TValues) => void;
  setSaving: (localId: string, saving: boolean) => void;
  setError: (localId: string, error: string | null) => void;
  markSaved: (localId: string, productId: string) => void;
}

export function useProductDraftSession<TValues>(
  config: UseProductDraftSessionConfig<TValues>,
): UseProductDraftSessionResult<TValues> {
  const { initialValues, mode = 'create', productId = null, copyValues } = config;
  const [session, setSession] = useState<ProductDraftSession<TValues>>(() =>
    startSession(createDraft(initialValues, { mode, productId })),
  );

  const addCopy = useCallback(
    () => setSession((current) => copyActiveDraft(current, copyValues)),
    [copyValues],
  );
  const selectDraft = useCallback(
    (localId: string) => setSession((current) => setActiveDraft(current, localId)),
    [],
  );
  const remove = useCallback(
    (localId: string) => setSession((current) => removeDraft(current, localId)),
    [],
  );
  const complete = useCallback(
    (localId: string) => setSession((current) => completeDraft(current, localId)),
    [],
  );
  const updateValues = useCallback(
    (values: TValues) => setSession((current) => updateDraftValues(current, current.activeId, values)),
    [],
  );
  const setSaving = useCallback(
    (localId: string, saving: boolean) =>
      setSession((current) => setDraftSaving(current, localId, saving)),
    [],
  );
  const setError = useCallback(
    (localId: string, error: string | null) =>
      setSession((current) => setDraftError(current, localId, error)),
    [],
  );
  const markSaved = useCallback(
    (localId: string, savedProductId: string) =>
      setSession((current) => markDraftSaved(current, localId, savedProductId)),
    [],
  );

  return {
    drafts: session.drafts,
    activeDraft: selectActiveDraft(session),
    canAdd: canAddDraft(session),
    hasUnsaved: hasUnsavedChanges(session),
    addCopy,
    selectDraft,
    remove,
    complete,
    updateValues,
    setSaving,
    setError,
    markSaved,
  };
}

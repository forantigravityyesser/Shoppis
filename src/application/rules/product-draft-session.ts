/**
 * Сессия черновиков товара (docs/23 §8, §9, §13.2, решение Q5).
 *
 * Чистая модель без зависимости от React: управляет коллекцией независимых черновиков и
 * активной карточкой. UI-адаптер (хук) в presentation вызывает эти функции и реагирует на
 * результат. Не хранит server-state и не сохраняет товары — это отдельный сценарий.
 *
 * Инварианты:
 * - у каждого черновика собственный `localId` (`crypto.randomUUID`, Q4) — не индекс массива;
 * - режим `create`/`edit` и `productId` разделены: edit-карточка и сохранённая копия не удаляются;
 * - операции не мутируют входную сессию и не затрагивают другие черновики (изоляция, §0.1 п.4);
 * - лимит карточек проверяется здесь, а не только в UI (§9).
 */

/** Максимум карточек в одной сессии: 1 исходная + до 5 копий (docs/23 §9). Клиентский лимит сессии. */
export const MAX_DRAFT_CARDS = 6;

export type DraftMode = 'create' | 'edit';

/** Производный статус карточки для UI (docs/23 §7.4). */
export type DraftStatus = 'draft' | 'changed' | 'saving' | 'saved' | 'error';

export interface ProductDraft<TValues> {
  /** Стабильный идентификатор черновика в рамках сессии. Не ID товара в БД. */
  localId: string;
  mode: DraftMode;
  /** ID товара: у edit-карточки — исходный; у копии — после успешного создания. */
  productId: string | null;
  values: TValues;
  saving: boolean;
  error: string | null;
  /** Есть несохранённые изменения относительно последнего сохранения. */
  dirty: boolean;
}

export interface ProductDraftSession<TValues> {
  drafts: ProductDraft<TValues>[];
  activeId: string;
}

export interface CreateDraftOptions {
  mode: DraftMode;
  productId?: string | null;
}

/** `crypto.randomUUID` с согласованным fallback для окружений без него (Q4). Без сторонних библиотек. */
function newLocalId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Новый черновик. `localId` присваивается здесь; `dirty` стартует `false`. */
export function createDraft<TValues>(
  values: TValues,
  options: CreateDraftOptions,
): ProductDraft<TValues> {
  return {
    localId: newLocalId(),
    mode: options.mode,
    productId: options.productId ?? null,
    values,
    saving: false,
    error: null,
    dirty: false,
  };
}

export function startSession<TValues>(
  draft: ProductDraft<TValues>,
): ProductDraftSession<TValues> {
  return { drafts: [draft], activeId: draft.localId };
}

export function findDraft<TValues>(
  session: ProductDraftSession<TValues>,
  localId: string,
): ProductDraft<TValues> | null {
  return session.drafts.find((draft) => draft.localId === localId) ?? null;
}

export function activeDraft<TValues>(
  session: ProductDraftSession<TValues>,
): ProductDraft<TValues> | null {
  return findDraft(session, session.activeId);
}

/** Проверка лимита (§9): до создания нового черновика. */
export function canAddDraft<TValues>(session: ProductDraftSession<TValues>): boolean {
  return session.drafts.length < MAX_DRAFT_CARDS;
}

/**
 * Удалять локально можно только несохранённую копию (create без `productId`).
 * Исходную edit-карточку и уже сохранённый товар этим действием удалить нельзя (§7.6).
 */
export function canRemoveDraft<TValues>(draft: ProductDraft<TValues>): boolean {
  return draft.mode === 'create' && draft.productId === null;
}

export function draftStatus<TValues>(draft: ProductDraft<TValues>): DraftStatus {
  if (draft.error) return 'error';
  if (draft.saving) return 'saving';
  if (draft.dirty) return 'changed';
  return draft.mode === 'edit' || draft.productId ? 'saved' : 'draft';
}

/** Есть ли незасохранённые данные хотя бы в одном черновике (для exit-guard, §7.6, Q3). */
export function hasUnsavedChanges<TValues>(session: ProductDraftSession<TValues>): boolean {
  return session.drafts.some((draft) => draft.dirty || draft.error !== null);
}

/** Точечно обновляет один черновик, не затрагивая остальные (изоляция). */
function patchDraft<TValues>(
  session: ProductDraftSession<TValues>,
  localId: string,
  patch: Partial<ProductDraft<TValues>>,
): ProductDraftSession<TValues> {
  const index = session.drafts.findIndex((draft) => draft.localId === localId);
  if (index < 0) return session;
  const drafts = session.drafts.slice();
  drafts[index] = { ...drafts[index], ...patch };
  return { ...session, drafts };
}

/**
 * Создаёт копию активного черновика через переданный `copyValues` (обычно `createProductCopy`).
 * Копия всегда в режиме `create` без `productId`; новой карточке отдаётся фокус (§7.3).
 * При достижении лимита возвращает сессию без изменений (UI дополнительно дизейблит действие).
 */
export function copyActiveDraft<TValues>(
  session: ProductDraftSession<TValues>,
  copyValues: (values: TValues) => TValues,
): ProductDraftSession<TValues> {
  if (!canAddDraft(session)) return session;
  const active = activeDraft(session);
  if (!active) return session;
  const draft = createDraft(copyValues(active.values), { mode: 'create', productId: null });
  return { drafts: [...session.drafts, draft], activeId: draft.localId };
}

export function setActiveDraft<TValues>(
  session: ProductDraftSession<TValues>,
  localId: string,
): ProductDraftSession<TValues> {
  if (!findDraft(session, localId)) return session;
  return { ...session, activeId: localId };
}

/** Убирает черновик по индексу; если он был активным — активным становится соседний. */
function removeAt<TValues>(
  session: ProductDraftSession<TValues>,
  index: number,
): ProductDraftSession<TValues> {
  const localId = session.drafts[index].localId;
  const drafts = session.drafts.filter((_, i) => i !== index);
  if (session.activeId !== localId) return { ...session, drafts };

  const next = drafts[Math.max(0, index - 1)] ?? drafts[0] ?? null;
  return { drafts, activeId: next ? next.localId : '' };
}

/**
 * Удаляет локальный черновик. Для несохранённых копий — удаляет; для edit-карточки и
 * сохранённого товара — no-op (§7.6). Если удалён активный, активным становится соседний.
 */
export function removeDraft<TValues>(
  session: ProductDraftSession<TValues>,
  localId: string,
): ProductDraftSession<TValues> {
  const index = session.drafts.findIndex((draft) => draft.localId === localId);
  if (index < 0) return session;
  if (!canRemoveDraft(session.drafts[index])) return session;
  return removeAt(session, index);
}

/**
 * Завершает черновик после **успешного сохранения** (docs/23 §7.3): карточка уходит из сессии
 * (её данные уже в БД), независимо от режима. Без ограничения `canRemoveDraft`.
 * Если сессия опустела — вызывающий экран решает, куда уйти.
 */
export function completeDraft<TValues>(
  session: ProductDraftSession<TValues>,
  localId: string,
): ProductDraftSession<TValues> {
  const index = session.drafts.findIndex((draft) => draft.localId === localId);
  if (index < 0) return session;
  return removeAt(session, index);
}

/** Пользовательское изменение значений: помечает карточку как изменённую. */
export function updateDraftValues<TValues>(
  session: ProductDraftSession<TValues>,
  localId: string,
  values: TValues,
): ProductDraftSession<TValues> {
  return patchDraft(session, localId, { values, dirty: true });
}

export function setDraftSaving<TValues>(
  session: ProductDraftSession<TValues>,
  localId: string,
  saving: boolean,
): ProductDraftSession<TValues> {
  return patchDraft(session, localId, { saving });
}

export function setDraftError<TValues>(
  session: ProductDraftSession<TValues>,
  localId: string,
  error: string | null,
): ProductDraftSession<TValues> {
  // Ошибка завершает попытку сохранения; сброс ошибки (`null`) не трогает флаг `saving`,
  // иначе `setError(id, null)` перед началом сохранения перебивал бы `setSaving(id, true)`.
  return patchDraft(session, localId, error ? { error, saving: false } : { error: null });
}

/**
 * Успешное сохранение конкретной карточки: привязывает `productId`, переводит карточку в
 * режим edit (повторное сохранение обновляет именно её) и снимает dirty/error (§0.1 п.1, §8.3).
 * Вызывается только после подтверждённого успеха.
 */
export function markDraftSaved<TValues>(
  session: ProductDraftSession<TValues>,
  localId: string,
  productId: string,
): ProductDraftSession<TValues> {
  return patchDraft(session, localId, {
    mode: 'edit',
    productId,
    dirty: false,
    saving: false,
    error: null,
  });
}

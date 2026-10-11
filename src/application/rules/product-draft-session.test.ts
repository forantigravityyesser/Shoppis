import { describe, expect, it } from 'vitest';
import {
  MAX_DRAFT_CARDS,
  activeDraft,
  canAddDraft,
  canRemoveDraft,
  completeDraft,
  copyActiveDraft,
  createDraft,
  draftStatus,
  findDraft,
  hasUnsavedChanges,
  markDraftSaved,
  removeDraft,
  setActiveDraft,
  setDraftError,
  setDraftSaving,
  startSession,
  updateDraftValues,
  type ProductDraftSession,
} from './product-draft-session';
import { createProductCopy, type ProductCopySource } from './product-copy';
import type { VariantForm } from './variant-form';

interface Values {
  title: string;
}

const rename = (values: Values): Values => ({ title: `${values.title} (копия)` });

function session(values: Values = { title: 'A' }): ProductDraftSession<Values> {
  return startSession(createDraft(values, { mode: 'create' }));
}

function variant(overrides: Partial<VariantForm> = {}): VariantForm {
  return {
    name: 'Размер',
    value: 'M',
    quantity: '12',
    price: '1900',
    discount: '0',
    priceMode: 'INHERITED',
    discountMode: 'INHERITED',
    ...overrides,
  };
}

describe('createDraft / startSession (docs/23 §8.1, §8.2)', () => {
  it('присваивает уникальный localId и стартовые поля', () => {
    const a = createDraft({ title: 'A' }, { mode: 'create' });
    const b = createDraft({ title: 'B' }, { mode: 'create' });
    expect(a.localId).toBeTruthy();
    expect(a.localId).not.toBe(b.localId);
    expect(a).toMatchObject({
      mode: 'create',
      productId: null,
      saving: false,
      error: null,
      dirty: false,
    });
  });

  it('edit-карточка несёт productId', () => {
    const draft = createDraft({ title: 'A' }, { mode: 'edit', productId: 'p1' });
    expect(draft.mode).toBe('edit');
    expect(draft.productId).toBe('p1');
  });

  it('startSession делает единственный черновик активным', () => {
    const draft = createDraft({ title: 'A' }, { mode: 'create' });
    const s = startSession(draft);
    expect(s.activeId).toBe(draft.localId);
    expect(activeDraft(s)).toBe(draft);
  });
});

describe('лимит карточек (docs/23 §9)', () => {
  it('разрешает создать карточки до лимита', () => {
    let s = session();
    while (canAddDraft(s)) s = copyActiveDraft(s, rename);
    expect(s.drafts).toHaveLength(MAX_DRAFT_CARDS);
    expect(canAddDraft(s)).toBe(false);
  });

  it('блокирует создание седьмой карточки и не меняет сессию', () => {
    let s = session();
    while (canAddDraft(s)) s = copyActiveDraft(s, rename);
    const activeId = s.activeId;

    const blocked = copyActiveDraft(s, rename);
    expect(blocked).toBe(s);
    expect(blocked.drafts).toHaveLength(MAX_DRAFT_CARDS);
    expect(blocked.activeId).toBe(activeId);
  });
});

describe('переключение (docs/23 §7.5, §8)', () => {
  it('переключает активный черновик; неизвестный id — no-op', () => {
    let s = session();
    const first = s.activeId;
    s = copyActiveDraft(s, rename);
    const second = s.activeId;
    expect(second).not.toBe(first);

    s = setActiveDraft(s, first);
    expect(s.activeId).toBe(first);

    const unchanged = setActiveDraft(s, 'missing');
    expect(unchanged).toBe(s);
  });

  it('не теряет несохранённые изменения при переключении', () => {
    let s = session({ title: 'A' });
    const idA = s.activeId;
    s = copyActiveDraft(s, rename);
    const idB = s.activeId;

    s = updateDraftValues(s, idA, { title: 'A изменён' });
    s = setActiveDraft(s, idB);
    s = setActiveDraft(s, idA);

    const a = findDraft(s, idA);
    const b = findDraft(s, idB);
    expect(a?.values.title).toBe('A изменён');
    expect(a?.dirty).toBe(true);
    expect(b?.values.title).toBe('A (копия)');
    expect(b?.dirty).toBe(false);
  });
});

describe('удаление черновика (docs/23 §7.6)', () => {
  it('удаляет несохранённую копию', () => {
    let s = session();
    s = copyActiveDraft(s, rename);
    const copyId = s.activeId;
    s = removeDraft(s, copyId);
    expect(s.drafts).toHaveLength(1);
    expect(findDraft(s, copyId)).toBeNull();
  });

  it('не удаляет исходную edit-карточку', () => {
    const draft = createDraft({ title: 'A' }, { mode: 'edit', productId: 'p1' });
    const s = startSession(draft);
    expect(canRemoveDraft(draft)).toBe(false);
    expect(removeDraft(s, draft.localId)).toBe(s);
  });

  it('не удаляет уже сохранённую копию', () => {
    let s = session();
    s = copyActiveDraft(s, rename);
    const copyId = s.activeId;
    s = markDraftSaved(s, copyId, 'new-p1');
    expect(removeDraft(s, copyId)).toBe(s);
  });

  it('при удалении активного черновика активным становится соседний', () => {
    let s = session();
    const first = s.activeId;
    s = copyActiveDraft(s, rename);
    const second = s.activeId;
    s = copyActiveDraft(s, rename);
    const third = s.activeId;
    expect(s.activeId).toBe(third);

    s = removeDraft(s, third);
    expect(s.activeId).toBe(second);
    expect(s.drafts.map((d) => d.localId)).toEqual([first, second]);
  });

  it('удаление единственного нового черновика даёт пустую допустимую сессию', () => {
    const s = session();
    const emptied = removeDraft(s, s.activeId);
    expect(emptied.drafts).toHaveLength(0);
    expect(emptied.activeId).toBe('');
    expect(activeDraft(emptied)).toBeNull();
  });
});

describe('completeDraft — карточка уходит после сохранения (docs/23 §7.3)', () => {
  it('убирает edit-карточку, в отличие от removeDraft', () => {
    const draft = createDraft({ title: 'A' }, { mode: 'edit', productId: 'p1' });
    const s = startSession(draft);
    expect(canRemoveDraft(draft)).toBe(false);

    const done = completeDraft(s, draft.localId);
    expect(done.drafts).toHaveLength(0);
    expect(done.activeId).toBe('');
  });

  it('после удаления активного активным становится соседний', () => {
    let s = session();
    const first = s.activeId;
    s = copyActiveDraft(s, rename);
    const second = s.activeId;
    s = copyActiveDraft(s, rename);
    const third = s.activeId;

    const done = completeDraft(s, third);
    expect(done.activeId).toBe(second);
    expect(done.drafts.map((d) => d.localId)).toEqual([first, second]);
  });

  it('неизвестный id — no-op', () => {
    const s = session();
    expect(completeDraft(s, 'missing')).toBe(s);
  });
});

describe('изоляция черновиков (docs/23 §0.1 п.4)', () => {
  it('ошибки одной карточки не влияют на другую', () => {
    let s = session();
    const idA = s.activeId;
    s = copyActiveDraft(s, rename);
    const idB = s.activeId;

    s = setDraftError(s, idA, 'Сервер недоступен');
    expect(findDraft(s, idA)?.error).toBe('Сервер недоступен');
    expect(findDraft(s, idB)?.error).toBeNull();
  });

  it('статусы сохранения независимы', () => {
    let s = session();
    const idA = s.activeId;
    s = copyActiveDraft(s, rename);
    const idB = s.activeId;
    s = updateDraftValues(s, idB, { title: 'B изменён' });

    s = markDraftSaved(s, idA, 'p1');

    expect(draftStatus(findDraft(s, idA)!)).toBe('saved');
    expect(findDraft(s, idA)?.productId).toBe('p1');
    expect(draftStatus(findDraft(s, idB)!)).toBe('changed');
    expect(findDraft(s, idB)?.productId).toBeNull();
  });
});

describe('статусы и несохранённые изменения (docs/23 §7.4)', () => {
  it('различает новую карточку, изменённую, сохранённую и ошибку', () => {
    const fresh = createDraft({ title: 'A' }, { mode: 'create' });
    const original = createDraft({ title: 'A' }, { mode: 'edit', productId: 'p1' });
    expect(draftStatus(fresh)).toBe('draft');
    expect(draftStatus(original)).toBe('saved');
    expect(draftStatus({ ...fresh, dirty: true })).toBe('changed');
    expect(draftStatus({ ...fresh, saving: true })).toBe('saving');
    expect(draftStatus({ ...fresh, error: 'boom' })).toBe('error');
  });

  it('hasUnsavedChanges учитывает dirty и ошибки сохранения', () => {
    let s = session();
    expect(hasUnsavedChanges(s)).toBe(false);
    s = updateDraftValues(s, s.activeId, { title: 'B' });
    expect(hasUnsavedChanges(s)).toBe(true);
  });

  it('setDraftSaving меняет флаг, не теряя данные и dirty', () => {
    let s = session();
    s = updateDraftValues(s, s.activeId, { title: 'B' });
    s = setDraftSaving(s, s.activeId, true);
    const draft = findDraft(s, s.activeId);
    expect(draft?.saving).toBe(true);
    expect(draft?.values.title).toBe('B');
    expect(draft?.dirty).toBe(true);
  });
});

describe('чистота операций (docs/23 §13.1, §8.4)', () => {
  it('операции не мутируют входную сессию', () => {
    const s0 = session({ title: 'A' });
    const firstId = s0.activeId;
    const s1 = copyActiveDraft(s0, rename);
    const copyId = s1.activeId;
    const s2 = setActiveDraft(s1, firstId);
    const s3 = updateDraftValues(s1, copyId, { title: 'B' });

    expect(s0.drafts).toHaveLength(1);
    expect(s1.drafts).toHaveLength(2);
    expect(s2).not.toBe(s1);
    expect(activeDraft(s1)?.localId).toBe(copyId);
    expect(s3.drafts).not.toBe(s1.drafts);
    expect(s3.drafts[1].values.title).toBe('B');
  });
});

describe('интеграция с createProductCopy (docs/23 §3.2, §6)', () => {
  it('копия получает данные копирования: без id и остатков, фото пусты', () => {
    const source: ProductCopySource = {
      title: 'Футболка',
      description: 'Хлопок',
      categoryId: 'cat-1',
      attributes: [{ name: 'Материал', value: 'Хлопок' }],
      variants: [variant({ id: 'v1', quantity: '12' })],
    };
    let s = startSession(createDraft(source, { mode: 'create' }));
    s = copyActiveDraft(s, createProductCopy);

    const copy = activeDraft(s)!.values as unknown as {
      variants: VariantForm[];
      images: unknown[];
    };
    expect(copy.variants[0].quantity).toBe('0');
    expect(copy.variants[0]).not.toHaveProperty('id');
    expect(copy.images).toEqual([]);
    // источник не тронут
    expect(s.drafts[0].values.variants[0].quantity).toBe('12');
  });
});

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { InventoryCategoryItem } from '../../../application/hooks/useInventory';
import { useInventoryActions } from '../../../application/hooks/useInventoryActions';
import { useProductDraftSession } from '../../../application/hooks/useProductDraftSession';
import { useProductDraftSave } from '../../../application/hooks/useProductDraftSave';
import { createProductCopy, hasCopyableContent } from '../../../application/rules/product-copy';
import {
  canRemoveDraft,
  draftStatus,
  type DraftMode,
  type DraftStatus,
} from '../../../application/rules/product-draft-session';
import { useStuck } from '../../shared/hooks/useStuck';
import { useUnsavedChangesGuard } from '../../shared/hooks/useUnsavedChangesGuard';
import ProductForm from './ProductForm';
import type { ProductFormValues } from './product-form-values';

const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  draft: 'Черновик',
  changed: 'Есть изменения',
  saving: 'Сохранение…',
  saved: 'Сохранена',
  error: 'Ошибка сохранения',
};

interface ProductDraftEditorProps {
  headerTitle: string;
  categories: InventoryCategoryItem[];
  /** Стартовые значения первого (активного) черновика. Используются при монтировании. */
  initialValues: ProductFormValues;
  mode: DraftMode;
  productId?: string | null;
  /** Куда уйти, когда сессия опустела (все карточки сохранены). */
  exitTo: string;
}

/**
 * Общий редактор товара с сессией независимых черновиков (docs/23 §3, §7, §13):
 * шапка с «+ Создать копию», навигация по черновикам и форма для активной карточки.
 * Используется и созданием, и редактированием; различия — только `headerTitle`/`mode`/`productId`.
 */
export default function ProductDraftEditor({
  headerTitle,
  categories,
  initialValues,
  mode,
  productId = null,
  exitTo,
}: ProductDraftEditorProps) {
  const navigate = useNavigate();
  const { createProduct, updateProduct } = useInventoryActions();
  const { drafts, activeDraft, canAdd, addCopy, selectDraft, remove, updateValues, complete, setSaving, setError } =
    useProductDraftSession({
      initialValues,
      mode,
      productId,
      copyValues: createProductCopy,
    });
  const onSubmit = useProductDraftSave({
    activeDraft,
    createProduct,
    updateProduct,
    complete,
    setSaving,
    setError,
  });

  const showCopy = activeDraft ? hasCopyableContent(activeDraft.values) : false;

  // Кнопки «Назад»/«Создать копию»: пока шапка видна — они в шапке, при скролле
  // залипают в углах под системными кнопками и становятся прозрачнее (docs/23 §7).
  const headerRef = useRef<HTMLDivElement>(null);
  const headerScrolled = useStuck(headerRef);

  // Несохранённые изменения: правки (dirty), ошибки сохранения и заполненные, но ещё не
  // сохранённые create-черновики (в т.ч. копии). docs/23 §7.6, Q3.
  const hasUnsaved = useMemo(
    () =>
      drafts.some(
        (draft) =>
          draft.dirty ||
          draft.error !== null ||
          (draft.productId === null && hasCopyableContent(draft.values)),
      ),
    [drafts],
  );
  useUnsavedChangesGuard(hasUnsaved);

  // Все карточки сохранены (успешно) — сессия опустела, уходим из формы.
  useEffect(() => {
    if (drafts.length === 0) navigate(exitTo, { replace: true });
  }, [drafts.length, exitTo, navigate]);

  const [confirmingExit, setConfirmingExit] = useState(false);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  const requestExit = () => {
    if (hasUnsaved) {
      setConfirmingRemoveId(null);
      setConfirmingExit(true);
      return;
    }
    navigate(-1);
  };

  // Удаление черновика (docs/23 §7.6): с подтверждением для заполненной карточки,
  // без — для пустой. Последнюю карточку удалять не предлагаем (форма остаётся валидной).
  const requestRemove = (draft: (typeof drafts)[number]) => {
    if (hasCopyableContent(draft.values)) {
      setConfirmingExit(false);
      setConfirmingRemoveId(draft.localId);
      return;
    }
    remove(draft.localId);
  };

  // Плавно поднимает экран к шапке. Возвращает `true`, если страница была прокручена
  // (то есть действие только что сработало и наверх уже едем).
  const scrollToTop = (): boolean => {
    const scroller = headerRef.current?.closest('.scrollable-content') as HTMLElement | null;
    if (scroller && scroller.scrollTop > 0) {
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }
    return false;
  };

  // Копия становится активной (см. `copyActiveDraft`) — сразу поднимаемся к новой карточке.
  const handleCopy = () => {
    addCopy();
    scrollToTop();
  };

  // Вне шапки (страница прокручена) «Назад» не выходит, а возвращает к шапке; выход
  // (с вопросом о несохранённых изменениях, docs/23 §7.6) — только когда шапка видна.
  const handleBack = () => {
    if (scrollToTop()) return;
    requestExit();
  };

  return (
    <>
      <div className="sticky-rail sticky-rail--between">
        <button
          type="button"
          className={`inv-icon-btn${headerScrolled ? ' inv-icon-btn--floating' : ''}`}
          onClick={handleBack}
          aria-label="Назад"
        >
          <ArrowLeft size={20} />
        </button>
        {showCopy ? (
          <button
            type="button"
            className={`inv-copy-btn${headerScrolled ? ' inv-copy-btn--floating' : ''}`}
            onClick={handleCopy}
            disabled={!canAdd}
            aria-label="Создать копию"
            title={canAdd ? 'Создать копию' : 'Достигнут лимит: 6 карточек'}
          >
            <Copy size={18} />
          </button>
        ) : null}
      </div>

      <div className="form-header form-header--center" ref={headerRef}>
        <span className="form-header__spacer" aria-hidden />
        <h1 className="form-header__title">{headerTitle}</h1>
        <span className="form-header__spacer" aria-hidden />
      </div>

      {confirmingExit ? (
        <div className="draft-exit-confirm" role="group" aria-label="Подтверждение действия">
          <p className="draft-exit-confirm__text">
            Есть несохранённые изменения. Выйти без сохранения?
          </p>
          <div className="draft-exit-confirm__actions">
            <button
              type="button"
              className="draft-exit-confirm__cancel"
              onClick={() => setConfirmingExit(false)}
            >
              Остаться
            </button>
            <button
              type="button"
              className="draft-exit-confirm__danger"
              onClick={() => {
                setConfirmingExit(false);
                navigate(-1);
              }}
            >
              Выйти
            </button>
          </div>
        </div>
      ) : null}

      {confirmingRemoveId ? (
        <div className="draft-exit-confirm" role="group" aria-label="Подтверждение действия">
          <p className="draft-exit-confirm__text">Удалить черновик без сохранения?</p>
          <div className="draft-exit-confirm__actions">
            <button
              type="button"
              className="draft-exit-confirm__cancel"
              onClick={() => setConfirmingRemoveId(null)}
            >
              Отмена
            </button>
            <button
              type="button"
              className="draft-exit-confirm__danger"
              onClick={() => {
                if (confirmingRemoveId) remove(confirmingRemoveId);
                setConfirmingRemoveId(null);
              }}
            >
              Удалить
            </button>
          </div>
        </div>
      ) : null}

      {drafts.length >= 2 ? (
        <>
          <div className="draft-nav" role="tablist" aria-label="Черновики товара">
            {drafts.map((draft, index) => {
              const active = draft.localId === activeDraft?.localId;
              const removable = drafts.length > 1 && canRemoveDraft(draft);
              return (
                <div className="draft-chip-wrap" key={draft.localId}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`draft-chip${active ? ' draft-chip--active' : ''}`}
                    onClick={() => selectDraft(draft.localId)}
                  >
                    <span className="draft-chip__name">
                      {index === 0 ? 'Исходная' : `Копия ${index}`}
                    </span>
                    <span className="draft-chip__status">
                      {DRAFT_STATUS_LABELS[draftStatus(draft)]}
                    </span>
                  </button>
                  {removable ? (
                    <button
                      type="button"
                      className="draft-chip__remove"
                      aria-label={`Удалить черновик ${index + 1}`}
                      onClick={() => requestRemove(draft)}
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!canAdd ? (
            <div className="draft-nav__limit">Достигнут лимит: 6 карточек в одной сессии</div>
          ) : null}
        </>
      ) : null}

      {activeDraft ? (
        <ProductForm
          key={activeDraft.localId}
          categories={categories}
          value={activeDraft.values}
          onChange={updateValues}
          onSubmit={onSubmit}
          submissionError={activeDraft.error}
          savePending={activeDraft.saving}
        />
      ) : null}
    </>
  );
}

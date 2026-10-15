import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { InventoryCategoryItem } from '../../../application/hooks/useInventory';
import { useInventoryActions } from '../../../application/hooks/useInventoryActions';
import { useProductDraftSession } from '../../../application/hooks/useProductDraftSession';
import { useProductDraftSave } from '../../../application/hooks/useProductDraftSave';
import type { InventoryImageItem } from '../../../application/read-models/inventory-view';
import { createProductCopy, hasCopyableContent } from '../../../application/rules/product-copy';
import { removeCatalogImages } from '../../../application/services/image-service';
import {
  canRemoveDraft,
  draftStatus,
  type DraftMode,
  type DraftStatus,
} from '../../../application/rules/product-draft-session';
import { useStuck } from '../../shared/hooks/useStuck';
import { useSmartBack } from '../../shared/hooks/useSmartBack';
import { useUnsavedChangesGuard } from '../../shared/hooks/useUnsavedChangesGuard';
import ProductForm from './ProductForm';
import type { ProductFormValues } from './product-form-values';

interface ProductDraftEditorProps {
  headerTitle: string;
  categories: InventoryCategoryItem[];
  /** Стартовые значения первого (активного) черновика. Используются при монтировании. */
  initialValues: ProductFormValues;
  mode: DraftMode;
  productId?: string | null;
  /** Куда уйти, когда сессия опустела (все карточки сохранены). */
  exitTo: string;
  /**
   * Куда открыть после сохранения последней карточки (напр. экран товара для сверки).
   * Если задан и товар был сохранён — имеет приоритет над `exitTo`.
   */
  savedTo?: (productId: string) => string;
  /** Сигнал подтверждённого сохранения товара (для обучения, docs/26 TUT-05). */
  onSavedProduct?: (productId: string) => void;
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
  savedTo,
  onSavedProduct,
}: ProductDraftEditorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goBack = useSmartBack();

  const draftStatusLabel = (status: DraftStatus): string => {
    switch (status) {
      case 'draft':
        return t('seller.product.draft.statusDraft');
      case 'changed':
        return t('seller.product.draft.statusChanged');
      case 'saving':
        return t('common.saving');
      case 'saved':
        return t('seller.product.draft.statusSaved');
      case 'error':
        return t('seller.product.draft.statusError');
    }
  };
  /** Id товара, сохранённого последним (для перехода на карточку, когда сессия опустеет). */
  const savedProductIdRef = useRef<string | null>(null);
  const { createProduct, updateProduct } = useInventoryActions();
  const {
    drafts,
    activeDraft,
    canAdd,
    addCopy,
    selectDraft,
    remove,
    updateValues,
    complete,
    setSaving,
    setError,
  } = useProductDraftSession({
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
    // Id последнего сохранённого товара — для перехода на его карточку после сверки.
    onSaved: (savedId) => {
      savedProductIdRef.current = savedId;
      // Подтверждённое сохранение: сигнал обучения (шаг product-create). docs/26 TUT-05.
      onSavedProduct?.(savedId);
    },
  });

  /**
   * Фото, уже сохранённые в БД (edit-режим): их удаление — задача успешного `update`
   * (product-slice), а не очистки черновика. Всё, что не входит в набор, загружено
   * в текущей сессии и удаляется из Storage, если карточка так и не сохранилась.
   */
  const persistedImageUrls = useMemo(() => {
    const urls = new Set<string>();
    if (mode === 'edit') {
      for (const image of initialValues.images) urls.add(image.url);
    }
    return urls;
  }, [mode, initialValues]);

  const persistedImageUrlsRef = useRef(persistedImageUrls);
  useEffect(() => {
    persistedImageUrlsRef.current = persistedImageUrls;
  }, [persistedImageUrls]);

  /** URL'ы, удаление которых уже запрошено: разные пути выхода не удаляют файл дважды. */
  const purgedImageUrlsRef = useRef(new Set<string>());

  /** Отбирает «свои» загрузки сессии из формы (всё, кроме фото из БД) и помечает их удалёнными. */
  const takeOrphanUploads = useCallback((images: InventoryImageItem[]): InventoryImageItem[] => {
    const orphans: InventoryImageItem[] = [];
    for (const image of images) {
      if (persistedImageUrlsRef.current.has(image.url)) continue;
      if (purgedImageUrlsRef.current.has(image.url)) continue;
      purgedImageUrlsRef.current.add(image.url);
      orphans.push(image);
    }
    return orphans;
  }, []);

  /** Удаляет переданные загрузки, если они не сохранены в БД (best-effort). */
  const removeUploadedImages = useCallback(
    (images: InventoryImageItem[]) => {
      const orphans = takeOrphanUploads(images);
      if (orphans.length) void removeCatalogImages(orphans);
    },
    [takeOrphanUploads],
  );

  /** Фото снято с формы до сохранения: «свои» загрузки чистятся сразу, фото из БД — нет. */
  const removePhotoUpload = useCallback(
    (image: InventoryImageItem) => removeUploadedImages([image]),
    [removeUploadedImages],
  );

  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  /** Убирает из Storage все несохранённые загрузки сессии (перед уходом без сохранения). */
  const purgeDraftUploads = useCallback(
    (draft: (typeof drafts)[number] | undefined) => {
      if (draft) removeUploadedImages(draft.values.images);
    },
    [removeUploadedImages],
  );

  // Страховка на уход вне штатных кнопок (системный Back, жест браузера): при
  // размонтировании удаляются загрузки черновиков, так и не попавшие в БД. Сохранённые
  // карточки уже вне сессии (`complete`), их фото — в Storage и не трогаются.
  useEffect(
    () => () => {
      removeUploadedImages(draftsRef.current.flatMap((draft) => draft.values.images));
    },
    [removeUploadedImages],
  );

  const exitWithoutSaving = useCallback(() => {
    removeUploadedImages(draftsRef.current.flatMap((draft) => draft.values.images));
    goBack(exitTo);
  }, [removeUploadedImages, goBack, exitTo]);

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
  // Для созданного товара открываем его карточку (сверка); «назад» оттуда ведёт в инвентарь,
  // потому что запись формы заменяется записью карточки (replace).
  useEffect(() => {
    if (drafts.length === 0) {
      const savedId = savedProductIdRef.current;
      navigate(savedTo && savedId ? savedTo(savedId) : exitTo, { replace: true });
    }
  }, [drafts.length, exitTo, savedTo, navigate]);

  const [confirmingExit, setConfirmingExit] = useState(false);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  const requestExit = () => {
    if (hasUnsaved) {
      setConfirmingRemoveId(null);
      setConfirmingExit(true);
      return;
    }
    exitWithoutSaving();
  };

  // Удаление черновика (docs/23 §7.6): с подтверждением для заполненной карточки,
  // без — для пустой. Последнюю карточку удалять не предлагаем (форма остаётся валидной).
  const requestRemove = (draft: (typeof drafts)[number]) => {
    if (hasCopyableContent(draft.values)) {
      setConfirmingExit(false);
      setConfirmingRemoveId(draft.localId);
      return;
    }
    purgeDraftUploads(draft);
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
          aria-label={t('common.back')}
        >
          <ArrowLeft size={20} />
        </button>
        {showCopy ? (
          <button
            type="button"
            className={`inv-copy-btn${headerScrolled ? ' inv-copy-btn--floating' : ''}`}
            onClick={handleCopy}
            disabled={!canAdd}
            aria-label={t('seller.product.draft.createCopy')}
            title={
              canAdd ? t('seller.product.draft.createCopy') : t('seller.product.draft.copyLimit')
            }
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
        <div className="draft-exit-confirm" role="group" aria-label={t('orders.confirmAria')}>
          <p className="draft-exit-confirm__text">{t('seller.product.draft.unsavedText')}</p>
          <div className="draft-exit-confirm__actions">
            <button
              type="button"
              className="draft-exit-confirm__cancel"
              onClick={() => setConfirmingExit(false)}
            >
              {t('seller.product.draft.stay')}
            </button>
            <button
              type="button"
              className="draft-exit-confirm__danger"
              onClick={() => {
                setConfirmingExit(false);
                exitWithoutSaving();
              }}
            >
              {t('seller.product.draft.exit')}
            </button>
          </div>
        </div>
      ) : null}

      {confirmingRemoveId ? (
        <div className="draft-exit-confirm" role="group" aria-label={t('orders.confirmAria')}>
          <p className="draft-exit-confirm__text">{t('seller.product.draft.removeDraftConfirm')}</p>
          <div className="draft-exit-confirm__actions">
            <button
              type="button"
              className="draft-exit-confirm__cancel"
              onClick={() => setConfirmingRemoveId(null)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="draft-exit-confirm__danger"
              onClick={() => {
                const draft = drafts.find((d) => d.localId === confirmingRemoveId);
                purgeDraftUploads(draft);
                if (confirmingRemoveId) remove(confirmingRemoveId);
                setConfirmingRemoveId(null);
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      ) : null}

      {drafts.length >= 2 ? (
        <>
          <div
            className="draft-nav"
            role="tablist"
            aria-label={t('seller.product.draft.draftsAria')}
          >
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
                      {index === 0
                        ? t('seller.product.draft.original')
                        : t('seller.product.draft.copyN', { number: index })}
                    </span>
                    <span className="draft-chip__status">
                      {draftStatusLabel(draftStatus(draft))}
                    </span>
                  </button>
                  {removable ? (
                    <button
                      type="button"
                      className="draft-chip__remove"
                      aria-label={t('seller.product.draft.removeDraftAria', {
                        number: index + 1,
                      })}
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
            <div className="draft-nav__limit">{t('seller.product.draft.limitText')}</div>
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
          onImageRemove={removePhotoUpload}
          submissionError={activeDraft.error}
          savePending={activeDraft.saving}
        />
      ) : null}
    </>
  );
}

import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import BottomSheet from '../../../shared/components/BottomSheet';
import type { InventoryCategoryItem } from '../../../../application/hooks/useInventory';
import { useInventoryActions } from '../../../../application/hooks/useInventoryActions';
import { useCategoryReorder } from '../../../../application/hooks/useCategoryReorder';
import { uploadCategoryCoverImage } from '../../../../application/services/image-service';
import { isSystemCategory } from '../../../../domain/rules/category-rules';
import ReorderCategorySheet from './ReorderCategorySheet';

interface EditCategorySheetProps {
  open: boolean;
  category: InventoryCategoryItem;
  /** Позиция категории на витрине (1-based) среди несистемных; null — не применимо. */
  orderPosition?: number | null;
  /** Общее число несистемных категорий (для «N из M»). */
  orderTotal?: number;
  onClose: () => void;
  /** Вызывается после успешного удаления категории (для навигации). */
  onDeleted?: () => void;
}

/** Редактирование категории: название, «Уведомлять об окончании», порядок, замена фото, удаление. */
export default function EditCategorySheet({
  open,
  category,
  orderPosition = null,
  orderTotal = 0,
  onClose,
  onDeleted,
}: EditCategorySheetProps) {
  const { updateCategory, deleteCategory } = useInventoryActions();
  const {
    pending: reorderPending,
    error: reorderError,
    reset: resetReorder,
    reorder,
  } = useCategoryReorder();
  const [name, setName] = useState(category.name);
  const [threshold, setThreshold] = useState(
    category.lowStockThreshold ? String(category.lowStockThreshold) : '',
  );
  const [photo, setPhoto] = useState<string | null>(category.imageUrl);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSave = name.trim().length > 0;
  const canDelete = !isSystemCategory(category.id);

  const addFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setProcessing(true);
    setUploadError(null);
    try {
      setPhoto(await uploadCategoryCoverImage(file));
    } catch (e) {
      console.error('[inventory] category photo upload failed', e);
      setUploadError('Не удалось загрузить фото. Попробуйте ещё раз.');
    } finally {
      setProcessing(false);
    }
  };

  const removePhoto = () => setPhoto(null);

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateCategory(category.id, {
        name,
        lowStockThreshold: threshold.trim() ? Number(threshold) : null,
        imageStorageKey: photo,
      });
      onClose();
    } catch (e) {
      console.error('[inventory] updateCategory failed', e);
      setSaveError('Не удалось сохранить категорию. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCategory(category.id);
    } catch {
      setDeleting(false);
      setDeleteError('Не удалось удалить категорию. Попробуйте ещё раз.');
      return;
    }
    onDeleted?.();
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="sheet__title">Редактировать категорию</h2>

      <div className="card__title">Фото</div>
      <div className="photo-grid photo-grid--single">
        {photo ? (
          <div className="photo-slot">
            <img className="photo-slot__img" src={photo} alt="" decoding="async" />
            <button
              type="button"
              className="photo-slot__remove"
              onClick={removePhoto}
              aria-label="Удалить фото"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="photo-slot photo-slot--add"
            disabled={processing}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Добавить фото"
          >
            {processing ? <span className="photo-slot__loading" aria-hidden /> : <Plus size={22} />}
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void addFile(e.target.files);
          e.target.value = '';
        }}
      />
      {uploadError ? (
        <div style={{ marginTop: 8, color: '#FF3B30', fontSize: 13 }}>{uploadError}</div>
      ) : null}

      <label className="field">
        <span className="field__label">Название</span>
        <input className="field__input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span className="field__label">Уведомлять об окончании</span>
        <input
          className="field__input"
          type="number"
          inputMode="numeric"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder="По умолчанию"
        />
      </label>

      {orderPosition != null ? (
        <div className="field">
          <span className="field__label">Порядок на витрине</span>
          <div className="cat-order">
            <span className="cat-order__value">
              {orderPosition} из {orderTotal || orderPosition}
            </span>
            <button
              type="button"
              className="variant-inherit"
              onClick={() => {
                resetReorder();
                setReorderOpen(true);
              }}
            >
              Изменить порядок
            </button>
          </div>
        </div>
      ) : null}

      {saveError ? (
        <div style={{ marginTop: 8, color: '#FF3B30', fontSize: 13 }} role="alert">
          {saveError}
        </div>
      ) : null}

      <div className="form-actions">
        <button
          type="button"
          className="btn-primary btn-primary--wide"
          disabled={!canSave || saving}
          onClick={() => void save()}
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>

      {canDelete ? (
        confirmDelete ? (
          <div className="sheet-danger">
            <p className="sheet-danger__text">
              Удалить категорию? Товары перейдут в «Без категории», обложка удалится из хранилища.
            </p>
            {deleteError ? (
              <div style={{ marginBottom: 8, color: '#FF3B30', fontSize: 13 }}>{deleteError}</div>
            ) : null}
            <div className="form-actions">
              <button
                type="button"
                className="btn-ghost"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="sheet-danger__btn"
                disabled={deleting}
                onClick={remove}
              >
                {deleting ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="sheet-danger__link"
            onClick={() => setConfirmDelete(true)}
          >
            Удалить категорию
          </button>
        )
      ) : null}

      {orderPosition != null ? (
        <ReorderCategorySheet
          open={reorderOpen}
          nested
          categoryName={category.name}
          total={orderTotal || orderPosition}
          currentPosition={orderPosition}
          pending={reorderPending}
          error={reorderError}
          onClose={() => {
            setReorderOpen(false);
            resetReorder();
          }}
          onSelect={(position) => {
            void reorder(category.id, position).then((ok) => {
              if (ok) {
                setReorderOpen(false);
                resetReorder();
              }
            });
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

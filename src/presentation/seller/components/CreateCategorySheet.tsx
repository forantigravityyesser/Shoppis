import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BottomSheet from '../../shared/components/BottomSheet';
import ImageCropSheet from '../../shared/components/ImageCropSheet';
import { useInventoryActions } from '../../../application/hooks/useInventoryActions';
import { uploadCategoryCoverImage } from '../../../application/services/image-service';
import { CATEGORY_OUTPUT_WIDTH } from '../../../utils/image';
import type { Category } from '../../../domain/models/category';

interface CreateCategorySheetProps {
  open: boolean;
  onClose: () => void;
  /** Категория создана: вызывающий выбирает её в форме товара. */
  onCreated?: (category: Category) => void;
}

/**
 * Создание категории прямо из формы товара: фото (квадрат) + название.
 * Визуально повторяет форму создания категории, но как вложенный bottom sheet
 * поверх пикера категорий, чтобы не покидать форму карточки товара.
 */
export default function CreateCategorySheet({
  open,
  onClose,
  onCreated,
}: CreateCategorySheetProps) {
  const { t } = useTranslation();
  const { createCategoryInPlace } = useInventoryActions();

  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = name.trim().length > 0;

  const addFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file) setCropFile(file);
  };

  const applyCrop = async (cropped: File) => {
    setCropFile(null);
    setProcessing(true);
    setUploadError(null);
    try {
      setPhoto(await uploadCategoryCoverImage(cropped));
    } catch (e) {
      console.error('[inventory] category photo upload failed', e);
      setUploadError(t('seller.inventory.editCategory.uploadError'));
    } finally {
      setProcessing(false);
    }
  };

  const removePhoto = () => setPhoto(null);

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const category = await createCategoryInPlace({ name, imageStorageKey: photo });
      onCreated?.(category);
      onClose();
    } catch (e) {
      console.error('[inventory] createCategory failed', e);
      setSubmitError(t('seller.inventory.createCategory.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={submitting ? () => {} : onClose} nested>
      <h2 className="sheet__title">{t('seller.inventory.createCategory.title')}</h2>

      <div className="card__title">{t('seller.inventory.photo')}</div>
      <div className="photo-grid photo-grid--single">
        {photo ? (
          <div className="photo-slot">
            <img className="photo-slot__img" src={photo} alt="" decoding="async" />
            <button
              type="button"
              className="photo-slot__remove"
              onClick={removePhoto}
              aria-label={t('seller.inventory.editCategory.removePhoto')}
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
            aria-label={t('seller.inventory.editCategory.addPhoto')}
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
          addFile(e.target.files);
          e.target.value = '';
        }}
      />
      {uploadError ? (
        <div style={{ marginTop: 8, color: '#FF3B30', fontSize: 13 }}>{uploadError}</div>
      ) : null}

      <label className="field">
        <span className="field__label">{t('seller.inventory.createCategory.nameLabel')}</span>
        <input
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('seller.inventory.createCategory.namePlaceholder')}
          autoFocus
        />
      </label>

      {submitError ? (
        <p className="prod-hint prod-hint--error" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="form-actions">
        <button
          type="button"
          className="btn-primary btn-primary--wide"
          disabled={!canSubmit || submitting}
          onClick={() => void submit()}
        >
          {submitting
            ? t('seller.inventory.createCategory.creating')
            : t('seller.inventory.createCategory.submit')}
        </button>
      </div>

      <ImageCropSheet
        open={cropFile !== null}
        file={cropFile}
        nested
        aspect={1}
        title={t('seller.inventory.editCategory.cropCover')}
        outputWidth={CATEGORY_OUTPUT_WIDTH}
        onConfirm={(file) => void applyCrop(file)}
        onClose={() => setCropFile(null)}
      />
    </BottomSheet>
  );
}

import { useRef, useState } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInventoryActions } from '../../../application/hooks/useInventoryActions';
import { uploadCategoryCoverImage } from '../../../application/services/image-service';
import { CATEGORY_OUTPUT_WIDTH } from '../../../utils/image';
import ImageCropSheet from '../../shared/components/ImageCropSheet';
import { useSmartBack } from '../../shared/hooks/useSmartBack';
import '../inventory/inventory.css';

/** Создание категории: одно фото (квадрат) + название. */
export default function CreateCategoryView() {
  const { t } = useTranslation();
  const goBack = useSmartBack();
  const { createCategory } = useInventoryActions();

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
      await createCategory({ name, imageStorageKey: photo });
    } catch (e) {
      console.error('[inventory] createCategory failed', e);
      setSubmitError(t('seller.inventory.createCategory.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen inv-form">
      <div className="form-header form-header--center">
        <button
          type="button"
          className="inv-icon-btn"
          onClick={() => goBack('/seller/inventory?mode=categories')}
          aria-label={t('common.back')}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-header__title">{t('seller.inventory.createCategory.title')}</h1>
        <span className="form-header__spacer" aria-hidden />
      </div>

      <section className="card">
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
              {processing ? (
                <span className="photo-slot__loading" aria-hidden />
              ) : (
                <Plus size={22} />
              )}
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
      </section>

      <section className="card">
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
      </section>

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
        aspect={1}
        title={t('seller.inventory.editCategory.cropCover')}
        outputWidth={CATEGORY_OUTPUT_WIDTH}
        onConfirm={(file) => void applyCrop(file)}
        onClose={() => setCropFile(null)}
      />
    </div>
  );
}

import { useRef, useState } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useInventoryActions } from '../../../application/hooks/useInventoryActions';
import { uploadCategoryCoverImage } from '../../../application/services/image-service';
import '../inventory/inventory.css';

/** Создание категории: одно фото (квадрат) + название. */
export default function CreateCategoryView() {
  const navigate = useNavigate();
  const { createCategory } = useInventoryActions();

  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = name.trim().length > 0;

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

  const submit = () => {
    if (!canSubmit) return;
    createCategory({ name, imageStorageKey: photo });
  };

  return (
    <div className="screen inv-form">
      <div className="form-header form-header--center">
        <button type="button" className="inv-icon-btn" onClick={() => navigate(-1)} aria-label="Назад">
          <ArrowLeft size={20} />
        </button>
        <h1 className="form-header__title">Новая категория</h1>
        <span className="form-header__spacer" aria-hidden />
      </div>

      <section className="card">
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
      </section>

      <section className="card">
        <label className="field">
          <span className="field__label">Название</span>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Овощи"
            autoFocus
          />
        </label>
      </section>

      <div className="form-actions">
        <button
          type="button"
          className="btn-primary btn-primary--wide"
          disabled={!canSubmit}
          onClick={submit}
        >
          Создать категорию
        </button>
      </div>
    </div>
  );
}

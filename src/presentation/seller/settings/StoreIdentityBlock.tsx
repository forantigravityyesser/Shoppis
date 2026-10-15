import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STORE_DESCRIPTION_MAX,
  normalizeStoreDescription,
  normalizeStoreName,
  validateStoreDescription,
} from '../../../domain/rules/store-settings-rules';
import type { Store } from '../../../domain/models/store';
import type { StoreProfilePatch } from '../../../application/contracts/store';
import { BANNER_ASPECT, BANNER_OUTPUT_WIDTH } from '../../../utils/image';
import BannerUploader from './components/BannerUploader';
import BlockSaveButton from './components/BlockSaveButton';
import ImageCropSheet from '../../shared/components/ImageCropSheet';

interface Props {
  store: Store;
  onSave: (patch: StoreProfilePatch) => Promise<void>;
  onUploadBanner: (file: File) => Promise<string>;
}

/**
 * Блок идентификации магазина: название + баннер. Draft живёт локально, в БД
 * уходит только по Save и только поля этого блока. 12 §7.
 */
export default function StoreIdentityBlock({ store, onSave, onUploadBanner }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState(store.description);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerValue, setBannerValue] = useState(store.bannerUrl);
  const [bannerPreview, setBannerPreview] = useState(store.bannerUrl);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValue = normalizeStoreName(name);
  const descriptionValue = normalizeStoreDescription(description);
  const isDirty =
    nameValue !== store.name ||
    descriptionValue !== store.description ||
    bannerFile !== null ||
    bannerValue !== store.bannerUrl;

  const pickBanner = (file: File) => {
    setCropFile(file);
    setError(null);
  };

  const applyBannerCrop = (cropped: File) => {
    setBannerFile(cropped);
    setBannerPreview((prev) => {
      if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(cropped);
    });
    setCropFile(null);
    setError(null);
  };

  const clearBanner = () => {
    setCropFile(null);
    setBannerFile(null);
    setBannerValue('');
    setBannerPreview((prev) => {
      if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return '';
    });
    setError(null);
  };

  const save = async () => {
    if (saving) return;
    if (!nameValue) {
      setError(t('seller.settings.identity.nameRequired'));
      return;
    }
    if (validateStoreDescription(descriptionValue)) {
      setError(t('seller.settings.identity.descriptionTooLong', { max: STORE_DESCRIPTION_MAX }));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let nextBanner: string | undefined;
      if (bannerFile) {
        nextBanner = await onUploadBanner(bannerFile);
      } else if (bannerValue !== store.bannerUrl) {
        nextBanner = bannerValue;
      }

      const patch: StoreProfilePatch = {};
      if (nameValue !== store.name) patch.name = nameValue;
      if (descriptionValue !== store.description) patch.description = descriptionValue;
      if (nextBanner !== undefined) patch.bannerUrl = nextBanner;
      await onSave(patch);

      const savedBanner = nextBanner ?? store.bannerUrl;
      setName(nameValue);
      setDescription(descriptionValue);
      setBannerValue(savedBanner);
      setBannerPreview(savedBanner);
      setBannerFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div className="card__title">{t('seller.settings.identity.title')}</div>

      <BannerUploader
        previewUrl={bannerPreview}
        busy={saving}
        onPick={pickBanner}
        onClear={clearBanner}
      />

      <input
        type="text"
        aria-label={t('seller.settings.identity.storeName')}
        placeholder={t('seller.settings.identity.storeName')}
        value={name}
        maxLength={60}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        className="settings-input"
      />

      <textarea
        aria-label={t('seller.settings.identity.descriptionLabel')}
        placeholder={t('seller.settings.identity.descriptionPlaceholder')}
        value={description}
        maxLength={STORE_DESCRIPTION_MAX}
        rows={3}
        onChange={(e) => {
          setDescription(e.target.value);
          setError(null);
        }}
        className="settings-textarea"
      />
      <div className="settings-counter">
        {description.length}/{STORE_DESCRIPTION_MAX}
      </div>

      {error ? (
        <div role="alert" className="settings-block-error">
          {error}
        </div>
      ) : null}

      <BlockSaveButton visible={isDirty} saving={saving} onClick={save} />

      <ImageCropSheet
        open={cropFile !== null}
        file={cropFile}
        aspect={BANNER_ASPECT}
        title={t('seller.settings.identity.cropBanner')}
        outputWidth={BANNER_OUTPUT_WIDTH}
        onConfirm={applyBannerCrop}
        onClose={() => setCropFile(null)}
      />
    </section>
  );
}

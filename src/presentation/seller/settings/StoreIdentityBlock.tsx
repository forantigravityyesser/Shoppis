import { useState } from 'react';
import { normalizeStoreName, validateStoreName } from '../../../domain/rules/store-settings-rules';
import type { Store } from '../../../domain/models/store';
import type { StoreProfilePatch } from '../../../application/contracts/store';
import BannerUploader from './components/BannerUploader';
import BlockSaveButton from './components/BlockSaveButton';

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
  const [name, setName] = useState(store.name);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerValue, setBannerValue] = useState(store.bannerUrl);
  const [bannerPreview, setBannerPreview] = useState(store.bannerUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValue = normalizeStoreName(name);
  const isDirty = nameValue !== store.name || bannerFile !== null || bannerValue !== store.bannerUrl;

  const pickBanner = (file: File) => {
    setBannerFile(file);
    setBannerPreview((prev) => {
      if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setError(null);
  };

  const clearBanner = () => {
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
    const validationError = validateStoreName(nameValue);
    if (validationError) {
      setError(validationError);
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
      if (nextBanner !== undefined) patch.bannerUrl = nextBanner;
      await onSave(patch);

      const savedBanner = nextBanner ?? store.bannerUrl;
      setName(nameValue);
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
      <div className="card__title">Магазин</div>

      <BannerUploader
        previewUrl={bannerPreview}
        busy={saving}
        onPick={pickBanner}
        onClear={clearBanner}
      />

      <input
        type="text"
        aria-label="Название магазина"
        placeholder="Название магазина"
        value={name}
        maxLength={60}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        style={styles.input}
      />

      {error ? (
        <div role="alert" style={styles.error}>
          {error}
        </div>
      ) : null}

      <BlockSaveButton visible={isDirty} saving={saving} onClick={save} />
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    border: '2px solid #EEE',
    fontSize: 16,
    fontWeight: 600,
    outline: 'none',
    background: '#FFFFFF',
    color: '#000',
    boxSizing: 'border-box',
  },
  error: { marginTop: 8, color: '#FF3B30', fontSize: 13 },
};

import { useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import type { StoreCurrency, StoreLanguage } from '../../../domain/models/store';
import { useStore } from '../../../application/store';

const CURRENCIES: Array<{ code: StoreCurrency; label: string }> = [
  { code: 'USD', label: 'USD ($)' },
  { code: 'RUB', label: 'RUB (₽)' },
  { code: 'BYN', label: 'BYN (Br)' },
];

const LANGUAGES: Array<{ code: StoreLanguage; label: string }> = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

/** Точная копия приветственного окна из старого проекта (SellerDashboard empty-state) + валюта/язык */
export default function SellerOnboardingView() {
  const createStore = useStore((s) => s.createStore);
  const uploadStoreBanner = useStore((s) => s.uploadStoreBanner);
  const authLoading = useStore((s) => s.authLoading);
  const authError = useStore((s) => s.authError);
  const setLanguage = useStore((s) => s.setLanguage);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<StoreCurrency>('USD');
  const [language, setLang] = useState<StoreLanguage>('ru');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = authLoading || uploading;

  const pickBanner = (file: File | undefined) => {
    if (!file) return;
    setBannerFile(file);
    setBannerPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearBanner = () => {
    setBannerFile(null);
    setBannerPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (!name.trim()) {
      setFormError('Введите название магазина');
      return;
    }
    setFormError(null);
    try {
      let bannerUrl = '';
      if (bannerFile) {
        setUploading(true);
        try {
          bannerUrl = await uploadStoreBanner(bannerFile);
        } finally {
          setUploading(false);
        }
      }
      setLanguage(language);
      await createStore({ name: name.trim(), currency, language, bannerUrl });
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={styles.emptyContainer}
    >
      <div style={styles.emptyIconWrapper}>
        <span style={{ fontSize: 40, lineHeight: 1 }}>🏬</span>
      </div>
      <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px', marginTop: 0, color: '#000' }}>
        Свой Магазин в Telegram
      </h2>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '24px', padding: '0 20px', lineHeight: '1.4', fontSize: '14px', marginTop: 0 }}>
        Создайте свой магазин прямо сейчас и начните принимать заказы!
      </p>

      <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={styles.bannerUploadCont}>
          {bannerPreview ? (
            <div style={styles.bannerPreviewCont}>
              <img src={bannerPreview} style={styles.bannerSmallImg} alt="Preview" />
              <button type="button" onClick={clearBanner} style={styles.clearBannerBtn} aria-label="Убрать баннер">✕</button>
            </div>
          ) : (
            <label style={styles.bannerLabel}>
              <span style={{ fontSize: 24, lineHeight: 1 }}>🖼️</span>
              <span style={{ fontSize: '13px', color: '#666' }}>Добавить баннер магазина</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => pickBanner(e.target.files?.[0])}
                style={{ display: 'none' }}
              />
            </label>
          )}
        </div>

        <input
          placeholder="Название (напр. Apple Hub)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.nameInput}
          maxLength={60}
        />

        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as StoreCurrency)}
          style={styles.nameInput}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>

        <select
          value={language}
          onChange={(e) => setLang(e.target.value as StoreLanguage)}
          style={styles.nameInput}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>

        {(formError || authError) && (
          <div style={{ textAlign: 'center', color: '#FF3B30', fontSize: 13 }}>{formError || authError}</div>
        )}

        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={submit}
          style={{
            ...styles.createBtn,
            opacity: busy || !name.trim() ? 0.7 : 1,
            cursor: busy || !name.trim() ? 'default' : 'pointer',
          }}
        >
          {uploading ? 'Загрузка баннера…' : authLoading ? 'Создаем...' : '🚀 Создать мой магазин'}
        </button>
      </div>
    </Motion.div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  emptyContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minHeight: '80vh', padding: '32px 24px 24px', background: 'var(--color-bg-app, #F0EDFF)' },
  emptyIconWrapper: { width: '96px', height: '96px', borderRadius: '32px', backgroundColor: '#F0EFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' },
  nameInput: { width: '100%', padding: '16px 20px', borderRadius: '16px', border: '2px solid #EEE', fontSize: '16px', fontWeight: 600, outline: 'none', transition: 'border-color 0.2s', background: '#FFFFFF', color: '#000', boxSizing: 'border-box' },
  createBtn: { width: '100%', padding: '18px', borderRadius: '16px', backgroundColor: '#6C5DD3', color: 'white', border: 'none', fontSize: '16px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 24px rgba(108,93,211,0.25)' },
  bannerUploadCont: { width: '100%', marginBottom: '8px' },
  bannerPreviewCont: { position: 'relative', width: '100%', height: '160px', borderRadius: '16px', overflow: 'hidden' } as React.CSSProperties,
  bannerSmallImg: { width: '100%', height: '100%', objectFit: 'cover' },
  clearBannerBtn: { position: 'absolute', top: '10px', right: '10px', width: '28px', height: '28px', borderRadius: '14px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, fontSize: 14 } as React.CSSProperties,
  bannerLabel: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', height: '160px', borderRadius: '16px', border: '2px dashed #DDD', backgroundColor: '#F9F9F9', cursor: 'pointer', boxSizing: 'border-box' } as React.CSSProperties,
};

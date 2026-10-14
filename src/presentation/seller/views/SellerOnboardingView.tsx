import { useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Coins, Globe, ImagePlus, LoaderCircle, Rocket, Store, X } from 'lucide-react';
import type { StoreCurrency, StoreLanguage } from '../../../domain/models/store';
import { useStore } from '../../../application/store';
import { BANNER_ASPECT, BANNER_OUTPUT_WIDTH } from '../../../utils/image';
import ImageCropSheet from '../../shared/components/ImageCropSheet';
import './seller-onboarding.css';

const CURRENCIES: Array<{ code: StoreCurrency; symbol: string }> = [
  { code: 'USD', symbol: '$' },
  { code: 'RUB', symbol: '₽' },
  { code: 'BYN', symbol: 'Br' },
];

const LANGUAGES: Array<{ code: StoreLanguage; flag: string }> = [
  { code: 'ru', flag: '🇷🇺' },
  { code: 'en', flag: '🇬🇧' },
];

/** Приветственное окно создания магазина (панель продавца). */
export default function SellerOnboardingView() {
  const { t } = useTranslation();
  const createStore = useStore((s) => s.createStore);
  const uploadStoreBanner = useStore((s) => s.uploadStoreBanner);
  const authLoading = useStore((s) => s.authLoading);
  const authError = useStore((s) => s.authError);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<StoreCurrency>('USD');
  const [language, setLang] = useState<StoreLanguage>('ru');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = authLoading || uploading;
  const error = formError || authError;

  const pickBanner = (file: File | undefined) => {
    if (!file) return;
    setCropFile(file);
  };

  const applyBannerCrop = (cropped: File) => {
    setBannerFile(cropped);
    setBannerPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(cropped);
    });
    setCropFile(null);
  };

  const clearBanner = () => {
    setCropFile(null);
    setBannerFile(null);
    setBannerPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (!name.trim()) {
      setFormError(t('seller.onboarding.nameRequired'));
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
      await createStore({ name: name.trim(), currency, language, bannerUrl });
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  return (
    <Motion.div
      className="onboarding"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <div className="onboarding__hero">
        <div className="onboarding__logo">
          <Store size={34} strokeWidth={2.2} aria-hidden />
        </div>
        <h1 className="onboarding__title">{t('seller.onboarding.title')}</h1>
        <p className="onboarding__subtitle">{t('seller.onboarding.subtitle')}</p>
      </div>

      <form
        className="onboarding__form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="onboarding__field">
          <span className="onboarding__label">
            <ImagePlus size={14} aria-hidden /> {t('seller.onboarding.banner')}
          </span>
          {bannerPreview ? (
            <div className="onboarding__banner-preview">
              <img src={bannerPreview} alt={t('seller.onboarding.bannerAlt')} decoding="async" />
              <button
                type="button"
                className="onboarding__banner-remove"
                onClick={clearBanner}
                aria-label={t('seller.onboarding.removeBanner')}
              >
                <X size={16} aria-hidden />
              </button>
              <label className="onboarding__banner-change">
                <ImagePlus size={13} aria-hidden />
                <span>{t('seller.onboarding.replace')}</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => pickBanner(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          ) : (
            <label className="onboarding__banner-drop">
              <span className="onboarding__banner-icon">
                <ImagePlus size={22} aria-hidden />
              </span>
              <span className="onboarding__banner-title">{t('seller.onboarding.addBanner')}</span>
              <span className="onboarding__banner-hint">
                {t('seller.onboarding.addBannerHint')}
              </span>
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

        <label className="onboarding__field">
          <span className="onboarding__label">{t('seller.onboarding.storeName')}</span>
          <input
            className="onboarding__input"
            placeholder={t('seller.onboarding.storeNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
        </label>

        <div className="onboarding__field">
          <span className="onboarding__label">
            <Coins size={14} aria-hidden /> {t('seller.onboarding.currency')}
          </span>
          <div className="onboarding__segmented">
            {CURRENCIES.map((c) => (
              <button
                type="button"
                key={c.code}
                className="onboarding__seg"
                data-active={currency === c.code}
                onClick={() => setCurrency(c.code)}
                aria-pressed={currency === c.code}
              >
                <span>{c.symbol}</span>
                <span>{c.code}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="onboarding__field">
          <span className="onboarding__label">
            <Globe size={14} aria-hidden /> {t('seller.onboarding.language')}
          </span>
          <div className="onboarding__segmented">
            {LANGUAGES.map((l) => (
              <button
                type="button"
                key={l.code}
                className="onboarding__seg"
                data-active={language === l.code}
                onClick={() => setLang(l.code)}
                aria-pressed={language === l.code}
              >
                <span>{l.flag}</span>
                <span>{t(`language.${l.code}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="onboarding__submit" disabled={busy || !name.trim()}>
          {busy ? (
            <LoaderCircle size={18} className="onboarding__spin" aria-hidden />
          ) : (
            <Rocket size={18} aria-hidden />
          )}
          <span>
            {uploading
              ? t('seller.onboarding.uploadingBanner')
              : authLoading
                ? t('seller.onboarding.creating')
                : t('seller.onboarding.create')}
          </span>
        </button>
      </form>

      <ImageCropSheet
        open={cropFile !== null}
        file={cropFile}
        aspect={BANNER_ASPECT}
        title={t('seller.settings.identity.cropBanner')}
        outputWidth={BANNER_OUTPUT_WIDTH}
        onConfirm={applyBannerCrop}
        onClose={() => setCropFile(null)}
      />
    </Motion.div>
  );
}

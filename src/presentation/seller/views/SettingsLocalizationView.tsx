import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import BackButton from '../../shared/components/BackButton';
import LocalizationBlock from '../settings/LocalizationBlock';

/**
 * Дочерний экран «Язык и валюта». Значения — из существующего
 * Store-контракта, списки не расширяются.
 */
export default function SettingsLocalizationView() {
  const { t } = useTranslation();
  const currentStore = useStore((s) => s.currentStore);
  const fetchCurrentStore = useStore((s) => s.fetchCurrentStore);
  const updateStoreProfile = useStore((s) => s.updateStoreProfile);
  const authLoading = useStore((s) => s.authLoading);

  useEffect(() => {
    if (!currentStore) void fetchCurrentStore();
  }, [currentStore, fetchCurrentStore]);

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/settings" />
        <h1 className="screen__title">{t('seller.settings.localizationTitle')}</h1>
      </div>

      {authLoading && !currentStore ? (
        <div className="card card__muted" style={{ textAlign: 'center' }}>
          {t('seller.settings.loading')}
        </div>
      ) : !currentStore ? (
        <div className="card card__muted" style={{ textAlign: 'center' }}>
          {t('seller.settings.notFound')}
        </div>
      ) : (
        <LocalizationBlock store={currentStore} onSave={updateStoreProfile} />
      )}
    </div>
  );
}

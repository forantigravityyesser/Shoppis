import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import BackButton from '../../shared/components/BackButton';
import StoreIdentityBlock from '../settings/StoreIdentityBlock';

/**
 * Дочерний экран «Профиль магазина»: название + баннер.
 * Блок переиспользован как есть; Hub сюда ведёт навигацией.
 */
export default function SettingsProfileView() {
  const { t } = useTranslation();
  const currentStore = useStore((s) => s.currentStore);
  const fetchCurrentStore = useStore((s) => s.fetchCurrentStore);
  const updateStoreProfile = useStore((s) => s.updateStoreProfile);
  const uploadStoreBanner = useStore((s) => s.uploadStoreBanner);
  const authLoading = useStore((s) => s.authLoading);

  useEffect(() => {
    if (!currentStore) void fetchCurrentStore();
  }, [currentStore, fetchCurrentStore]);

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/settings" />
        <h1 className="screen__title">{t('seller.settings.profileTitle')}</h1>
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
        <StoreIdentityBlock
          store={currentStore}
          onSave={updateStoreProfile}
          onUploadBanner={uploadStoreBanner}
        />
      )}
    </div>
  );
}

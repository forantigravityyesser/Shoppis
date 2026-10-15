import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useCurrentStore } from '../../../application/hooks/useCurrentStore';
import BackButton from '../../shared/components/BackButton';
import StoreLoadState from '../../shared/components/StoreLoadState';
import StoreIdentityBlock from '../settings/StoreIdentityBlock';

/**
 * Дочерний экран «Профиль магазина»: название + баннер.
 * Блок переиспользован как есть; Hub сюда ведёт навигацией.
 */
export default function SettingsProfileView() {
  const { t } = useTranslation();
  const { store: currentStore, loading, error, notFound, retry } = useCurrentStore();
  const updateStoreProfile = useStore((s) => s.updateStoreProfile);
  const uploadStoreBanner = useStore((s) => s.uploadStoreBanner);

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/settings" />
        <h1 className="screen__title">{t('seller.settings.profileTitle')}</h1>
      </div>

      <StoreLoadState loading={loading} error={error} notFound={notFound} onRetry={retry}>
        {currentStore ? (
          <StoreIdentityBlock
            store={currentStore}
            onSave={updateStoreProfile}
            onUploadBanner={uploadStoreBanner}
          />
        ) : null}
      </StoreLoadState>
    </div>
  );
}

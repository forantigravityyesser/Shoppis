import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useCurrentStore } from '../../../application/hooks/useCurrentStore';
import BackButton from '../../shared/components/BackButton';
import StoreLoadState from '../../shared/components/StoreLoadState';
import LocalizationBlock from '../settings/LocalizationBlock';

/**
 * Дочерний экран «Язык и валюта». Значения — из существующего
 * Store-контракта, списки не расширяются.
 */
export default function SettingsLocalizationView() {
  const { t } = useTranslation();
  const { store: currentStore, loading, error, notFound, retry } = useCurrentStore();
  const updateStoreProfile = useStore((s) => s.updateStoreProfile);

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/settings" />
        <h1 className="screen__title">{t('seller.settings.localizationTitle')}</h1>
      </div>

      <StoreLoadState loading={loading} error={error} notFound={notFound} onRetry={retry}>
        {currentStore ? (
          <LocalizationBlock store={currentStore} onSave={updateStoreProfile} />
        ) : null}
      </StoreLoadState>
    </div>
  );
}

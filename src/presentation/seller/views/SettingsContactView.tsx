import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useCurrentStore } from '../../../application/hooks/useCurrentStore';
import BackButton from '../../shared/components/BackButton';
import StoreLoadState from '../../shared/components/StoreLoadState';
import CommunicationBlock from '../settings/CommunicationBlock';

/** Дочерний экран «Контакты»: buyer contact / support handle. */
export default function SettingsContactView() {
  const { t } = useTranslation();
  const { store: currentStore, loading, error, notFound, retry } = useCurrentStore();
  const updateStoreProfile = useStore((s) => s.updateStoreProfile);
  const serverUser = useStore((s) => s.serverUser);

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/settings" />
        <h1 className="screen__title">{t('seller.settings.contactTitle')}</h1>
      </div>

      <StoreLoadState loading={loading} error={error} notFound={notFound} onRetry={retry}>
        {currentStore ? (
          <CommunicationBlock
            store={currentStore}
            suggestedUsername={serverUser?.username ?? ''}
            onSave={updateStoreProfile}
          />
        ) : null}
      </StoreLoadState>
    </div>
  );
}

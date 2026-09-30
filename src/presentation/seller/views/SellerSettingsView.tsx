import { useEffect } from 'react';
import { useStore } from '../../../application/store';
import { useStorefrontLink } from '../../../application/hooks/useStorefrontLink';
import BackButton from '../../shared/components/BackButton';
import StoreIdentityBlock from '../settings/StoreIdentityBlock';
import LocalizationBlock from '../settings/LocalizationBlock';
import StoreStatusBlock from '../settings/StoreStatusBlock';
import CommunicationBlock from '../settings/CommunicationBlock';
import SharePreviewBlock from '../settings/SharePreviewBlock';

/**
 * Настройки магазина. Пока реализован блок идентификации (название + баннер);
 * локализация, статус, контакт и ссылка — следующие вертикальные срезы (docs/12).
 */
export default function SellerSettingsView() {
  const currentStore = useStore((s) => s.currentStore);
  const fetchCurrentStore = useStore((s) => s.fetchCurrentStore);
  const updateStoreProfile = useStore((s) => s.updateStoreProfile);
  const updateStoreStatus = useStore((s) => s.updateStoreStatus);
  const uploadStoreBanner = useStore((s) => s.uploadStoreBanner);
  const serverUser = useStore((s) => s.serverUser);
  const storefrontUrl = useStorefrontLink(currentStore?.publicId ?? '');
  const authLoading = useStore((s) => s.authLoading);

  useEffect(() => {
    if (!currentStore) void fetchCurrentStore();
  }, [currentStore, fetchCurrentStore]);

  return (
    <div className="screen">
      <div className="screen__header screen__header--row">
        <BackButton fallback="/seller/dashboard" />
        <h1 className="screen__title">Настройки</h1>
      </div>

      {authLoading && !currentStore ? (
        <div className="card card__muted" style={{ textAlign: 'center' }}>
          Загрузка магазина…
        </div>
      ) : !currentStore ? (
        <div className="card card__muted" style={{ textAlign: 'center' }}>
          Магазин не найден
        </div>
      ) : (
        <>
          <StoreStatusBlock store={currentStore} onSaveStatus={updateStoreStatus} />
          <StoreIdentityBlock
            store={currentStore}
            onSave={updateStoreProfile}
            onUploadBanner={uploadStoreBanner}
          />
          <CommunicationBlock
            store={currentStore}
            suggestedUsername={serverUser?.username ?? ''}
            onSave={updateStoreProfile}
          />
          <LocalizationBlock store={currentStore} onSave={updateStoreProfile} />
          <SharePreviewBlock url={storefrontUrl} previewEnabled={false} />
        </>
      )}
    </div>
  );
}

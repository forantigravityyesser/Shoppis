import { useTranslation } from 'react-i18next';
import { useCurrentStore } from '../../../application/hooks/useCurrentStore';
import { useStorefrontLink } from '../../../application/hooks/useStorefrontLink';
import BackButton from '../../shared/components/BackButton';
import StoreLoadState from '../../shared/components/StoreLoadState';
import SharePreviewBlock from '../settings/SharePreviewBlock';

/**
 * Дочерний экран «Поделиться магазином»: существующий Direct Mini App
 * link (`startapp=shop_<public_id>`) и копирование.
 * Кнопки предпросмотра здесь нет — у него отдельная строка в Hub.
 * Генерация ссылки — через существующий хук, формат не меняется.
 */
export default function SettingsShareView() {
  const { t } = useTranslation();
  const { store: currentStore, loading, error, notFound, retry } = useCurrentStore();
  const storefrontUrl = useStorefrontLink(currentStore?.publicId ?? '');

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/settings" />
        <h1 className="screen__title">{t('seller.settings.shareTitle')}</h1>
      </div>

      <StoreLoadState loading={loading} error={error} notFound={notFound} onRetry={retry}>
        {currentStore ? <SharePreviewBlock url={storefrontUrl} showPreview={false} /> : null}
      </StoreLoadState>
    </div>
  );
}

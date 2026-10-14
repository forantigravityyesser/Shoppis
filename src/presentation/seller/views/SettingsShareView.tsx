import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useStorefrontLink } from '../../../application/hooks/useStorefrontLink';
import BackButton from '../../shared/components/BackButton';
import SharePreviewBlock from '../settings/SharePreviewBlock';

/**
 * Дочерний экран «Поделиться магазином»: существующий Direct Mini App
 * link (`startapp=shop_<public_id>`) и копирование.
 * Кнопки предпросмотра здесь нет — у него отдельная строка в Hub.
 * Генерация ссылки — через существующий хук, формат не меняется.
 */
export default function SettingsShareView() {
  const { t } = useTranslation();
  const currentStore = useStore((s) => s.currentStore);
  const fetchCurrentStore = useStore((s) => s.fetchCurrentStore);
  const authLoading = useStore((s) => s.authLoading);
  const storefrontUrl = useStorefrontLink(currentStore?.publicId ?? '');

  useEffect(() => {
    if (!currentStore) void fetchCurrentStore();
  }, [currentStore, fetchCurrentStore]);

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/settings" />
        <h1 className="screen__title">{t('seller.settings.shareTitle')}</h1>
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
        <SharePreviewBlock url={storefrontUrl} showPreview={false} />
      )}
    </div>
  );
}

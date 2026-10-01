import { useEffect } from 'react';
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
        <h1 className="screen__title">Поделиться магазином</h1>
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
        <SharePreviewBlock url={storefrontUrl} showPreview={false} />
      )}
    </div>
  );
}

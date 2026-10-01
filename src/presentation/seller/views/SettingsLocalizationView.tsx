import { useEffect } from 'react';
import { useStore } from '../../../application/store';
import BackButton from '../../shared/components/BackButton';
import LocalizationBlock from '../settings/LocalizationBlock';

/**
 * Дочерний экран «Язык и валюта». Значения — из существующего
 * Store-контракта, списки не расширяются.
 */
export default function SettingsLocalizationView() {
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
        <h1 className="screen__title">Язык и валюта</h1>
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
        <LocalizationBlock store={currentStore} onSave={updateStoreProfile} />
      )}
    </div>
  );
}

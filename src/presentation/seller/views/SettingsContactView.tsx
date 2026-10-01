import { useEffect } from 'react';
import { useStore } from '../../../application/store';
import BackButton from '../../shared/components/BackButton';
import CommunicationBlock from '../settings/CommunicationBlock';

/** Дочерний экран «Контакты»: buyer contact / support handle. */
export default function SettingsContactView() {
  const currentStore = useStore((s) => s.currentStore);
  const fetchCurrentStore = useStore((s) => s.fetchCurrentStore);
  const updateStoreProfile = useStore((s) => s.updateStoreProfile);
  const serverUser = useStore((s) => s.serverUser);
  const authLoading = useStore((s) => s.authLoading);

  useEffect(() => {
    if (!currentStore) void fetchCurrentStore();
  }, [currentStore, fetchCurrentStore]);

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/settings" />
        <h1 className="screen__title">Контакты</h1>
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
        <CommunicationBlock
          store={currentStore}
          suggestedUsername={serverUser?.username ?? ''}
          onSave={updateStoreProfile}
        />
      )}
    </div>
  );
}

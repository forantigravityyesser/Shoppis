import { useEffect } from 'react';
import { useStore } from '../../../application/store';

/**
 * Настройки продавца. Обзор витрины (баннер, название, валюта, язык, поддержка)
 * перенесён сюда с прежнего дашборда; сам дашборд — операционная панель.
 */
export default function SellerSettingsView() {
  const currentStore = useStore((s) => s.currentStore);
  const fetchCurrentStore = useStore((s) => s.fetchCurrentStore);
  const authLoading = useStore((s) => s.authLoading);

  useEffect(() => {
    if (!currentStore) void fetchCurrentStore();
  }, [currentStore, fetchCurrentStore]);

  return (
    <div className="screen">
      <div className="screen__header">
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
        <section className="card">
          <div className="card__title">Магазин</div>

          {currentStore.bannerUrl ? (
            <img src={currentStore.bannerUrl} alt="Баннер" style={styles.banner} />
          ) : (
            <div style={styles.bannerPlaceholder}>📷</div>
          )}

          <div style={styles.name}>{currentStore.name}</div>
          {currentStore.description ? <div style={styles.desc}>{currentStore.description}</div> : null}

          <Row label="Валюта" value={`${currentStore.currencyCode} (${currentStore.currencySymbol})`} />
          <Row label="Язык" value={currentStore.language === 'ru' ? 'Русский' : 'English'} />
          <Row label="Поддержка" value={currentStore.supportHandle || '—'} />

          <div style={styles.note}>Редактирование профиля магазина — следующий этап</div>
        </section>
      )}

      <div className="card card__muted">Полные настройки (товары, заказы, ссылка-приглашение) — следующие этапы</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <span className="row__label">{label}</span>
      <span className="row__value">{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: { width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 180, marginBottom: 12 },
  bannerPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    background: 'var(--color-input-bg, #F2F2F7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 48,
    opacity: 0.4,
    marginBottom: 12,
  },
  name: { fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary, #1A1A2E)' },
  desc: { fontSize: 13, color: 'var(--color-text-secondary, #8E8E93)', marginTop: 4 },
  note: { fontSize: 12, color: 'var(--color-text-secondary, #8E8E93)', marginTop: 8 },
};

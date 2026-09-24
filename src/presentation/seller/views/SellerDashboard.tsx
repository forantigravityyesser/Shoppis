import { useEffect } from 'react';
import { useStore } from '../../../application/store';

/** Заглушка дашборда: баннер, название, основная информация, вкладка настроек */
export default function SellerDashboard() {
  const currentStore = useStore((s) => s.currentStore);
  const fetchCurrentStore = useStore((s) => s.fetchCurrentStore);
  const authLoading = useStore((s) => s.authLoading);

  useEffect(() => {
    if (!currentStore) void fetchCurrentStore();
  }, [currentStore, fetchCurrentStore]);

  if (authLoading && !currentStore) {
    return (
      <div style={styles.screen}>
        <div style={styles.muted}>Загрузка магазина…</div>
      </div>
    );
  }

  if (!currentStore) {
    return (
      <div style={styles.screen}>
        <div style={styles.muted}>Магазин не найден</div>
      </div>
    );
  }

  return (
    <div style={styles.screen}>
      {currentStore.bannerUrl ? (
        <img src={currentStore.bannerUrl} alt="Баннер" style={styles.banner} />
      ) : (
        <div style={styles.bannerPlaceholder}>📷</div>
      )}

      <div style={styles.card}>
        <div style={styles.name}>{currentStore.name}</div>
        {currentStore.description ? <div style={styles.desc}>{currentStore.description}</div> : null}
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Настройки магазина</div>
        <Row label="Валюта" value={`${currentStore.currency} (${currentStore.currencySymbol})`} />
        <Row label="Язык" value={currentStore.language === 'ru' ? 'Русский' : 'English'} />
        <Row label="Поддержка" value={currentStore.supportHandle || '—'} />
        <div style={styles.note}>Полные настройки (товары, заказы, ссылка-приглашение) — следующие этапы</div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  screen: {
    minHeight: '100vh',
    background: 'var(--color-bg-app, #F0EDFF)',
    padding: 16,
    maxWidth: 480,
    margin: '0 auto',
  },
  banner: { width: '100%', borderRadius: 16, objectFit: 'cover', maxHeight: 180 },
  bannerPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    background: 'var(--color-input-bg, #F2F2F7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 48,
    opacity: 0.4,
  },
  card: {
    background: 'var(--color-bg-card, #FFFFFF)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-card, 0 2px 12px rgba(108, 92, 231, 0.08))',
    padding: 16,
    marginTop: 12,
  },
  name: { fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary, #1A1A2E)' },
  desc: { fontSize: 13, color: 'var(--color-text-secondary, #8E8E93)', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary, #1A1A2E)', marginBottom: 8 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 },
  rowLabel: { color: 'var(--color-text-secondary, #8E8E93)' },
  rowValue: { color: 'var(--color-text-primary, #1A1A2E)', fontWeight: 500 },
  note: { fontSize: 12, color: 'var(--color-text-secondary, #8E8E93)', marginTop: 8 },
  muted: { textAlign: 'center', padding: 40, color: 'var(--color-text-secondary, #8E8E93)', fontSize: 14 },
};

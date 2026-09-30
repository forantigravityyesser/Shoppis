import { Send } from 'lucide-react';
import type { Store } from '../../../domain/models/store';

interface Props {
  store: Store | null;
  loading: boolean;
}

/**
 * Публичная витрина магазина. Реализует статус-гейт: PAUSED — экран паузы,
 * ACTIVE — витрина. Каталог товаров — следующий слой buyer storefront. 04 §18.
 */
export default function StorefrontView({ store, loading }: Props) {
  if (loading && !store) {
    return <div className="card card__muted">Загрузка магазина…</div>;
  }
  if (!store) {
    return <div className="card card__muted">Магазин не найден</div>;
  }

  if (store.status === 'PAUSED') {
    return (
      <div className="screen" style={styles.pausedWrap}>
        <div style={styles.pausedIcon}>⏸️</div>
        <h1 style={styles.pausedTitle}>Магазин временно закрыт</h1>
        <p style={styles.muted}>Магазин на техническом обслуживании. Загляните позже.</p>
        {store.supportHandle ? <ContactButton handle={store.supportHandle} /> : null}
      </div>
    );
  }

  return (
    <div className="screen">
      {store.bannerUrl ? (
        <img src={store.bannerUrl} alt={store.name} style={styles.banner} decoding="async" />
      ) : (
        <div style={styles.bannerPlaceholder}>🏬</div>
      )}

      <h1 style={styles.name}>{store.name}</h1>
      {store.description ? <p style={styles.muted}>{store.description}</p> : null}
      {store.supportHandle ? <ContactButton handle={store.supportHandle} /> : null}

      <div className="card card__muted" style={{ marginTop: 16 }}>
        Каталог товаров появится на следующем этапе
      </div>
    </div>
  );
}

function ContactButton({ handle }: { handle: string }) {
  return (
    <a
      href={`https://t.me/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Связаться с продавцом"
      style={styles.contact}
    >
      <Send size={16} />
      Связаться с продавцом
    </a>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: { width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 16 },
  bannerPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    background: '#F0EFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 48,
  },
  name: { fontSize: 22, fontWeight: 900, margin: '14px 0 4px', color: '#1A1A2E' },
  muted: { fontSize: 14, color: 'var(--color-text-secondary, #8E8E93)', margin: '4px 0' },
  contact: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: '12px 16px',
    borderRadius: 14,
    background: '#2AABEE',
    color: '#FFFFFF',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: 14,
  },
  pausedWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 48 },
  pausedIcon: { fontSize: 48, lineHeight: 1, marginBottom: 12 },
  pausedTitle: { fontSize: 20, fontWeight: 900, margin: '0 0 6px', color: '#1A1A2E' },
};

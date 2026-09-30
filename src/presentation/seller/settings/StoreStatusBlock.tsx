import { useState } from 'react';
import type { Store, StoreStatus } from '../../../domain/models/store';
import BlockSaveButton from './components/BlockSaveButton';

interface Props {
  store: Store;
  onSaveStatus: (status: StoreStatus) => Promise<void>;
}

/**
 * Операционный статус витрины: ACTIVE ↔ PAUSED. Отдельно от profile patch.
 * Переход в PAUSED требует явного подтверждения (магазин закрывается для покупателей). 12 §5.
 */
export default function StoreStatusBlock({ store, onSaveStatus }: Props) {
  const [status, setStatus] = useState<StoreStatus>(store.status);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = status === 'ACTIVE';
  const isDirty = status !== store.status;

  const applyStatus = async (next: StoreStatus) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveStatus(next);
      setStatus(next);
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (saving) return;
    if (status === 'PAUSED') {
      setConfirming(true);
      return;
    }
    void applyStatus(status);
  };

  return (
    <section className="card">
      <div className="card__title">Статус магазина</div>

      <div style={styles.row}>
        <div style={styles.textCol}>
          <span style={styles.state}>{active ? 'Магазин активен' : 'Магазин приостановлен'}</span>
          <span style={styles.hint}>
            {active
              ? 'Покупатели видят витрину и могут оформлять заказы.'
              : 'Покупатели видят экран «Магазин временно закрыт». Управление доступно.'}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label="Магазин активен"
          disabled={saving}
          onClick={() => {
            setStatus(active ? 'PAUSED' : 'ACTIVE');
            setConfirming(false);
            setError(null);
          }}
          style={{ ...styles.switch, ...(active ? styles.switchOn : null) }}
        >
          <span style={styles.knob} />
        </button>
      </div>

      {error ? (
        <div role="alert" style={styles.error}>
          {error}
        </div>
      ) : null}

      {confirming ? (
        <div style={styles.confirm}>
          <span style={styles.confirmText}>
            Магазин временно закроется для покупателей. Продолжить?
          </span>
          <div style={styles.confirmActions}>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={styles.cancelBtn}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void applyStatus('PAUSED')}
              style={styles.dangerBtn}
              disabled={saving}
            >
              {saving ? 'Приостановка…' : 'Приостановить'}
            </button>
          </div>
        </div>
      ) : (
        <BlockSaveButton visible={isDirty} saving={saving} onClick={save} />
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 12 },
  textCol: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  state: { fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary, #1A1A2E)' },
  hint: { fontSize: 12, color: 'var(--color-text-secondary, #8E8E93)' },
  switch: {
    flexShrink: 0,
    width: 52,
    height: 32,
    borderRadius: 16,
    border: 'none',
    backgroundColor: '#D1D1D6',
    padding: 2,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'background-color 0.2s',
  },
  switchOn: { backgroundColor: '#34C759', justifyContent: 'flex-end' },
  knob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  error: { marginTop: 8, color: '#FF3B30', fontSize: 13 },
  confirm: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'var(--color-input-bg, #F2F2F7)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  confirmText: { fontSize: 13, color: 'var(--color-text-primary, #1A1A2E)' },
  confirmActions: { display: 'flex', gap: 8 },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: '#FFFFFF',
    color: '#1A1A2E',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  dangerBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: '#FF3B30',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
};

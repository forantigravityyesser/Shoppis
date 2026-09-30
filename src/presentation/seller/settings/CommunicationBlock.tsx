import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { normalizeTelegramUsername } from '../../../domain/rules/store-contact-rules';
import type { Store } from '../../../domain/models/store';
import type { StoreProfilePatch } from '../../../application/contracts/store';
import BlockSaveButton from './components/BlockSaveButton';

interface Props {
  store: Store;
  /** Telegram username продавца для явной подстановки (пусто — кнопка недоступна). */
  suggestedUsername: string;
  onSave: (patch: StoreProfilePatch) => Promise<void>;
}

const INVALID_MESSAGE = 'Введите username, @username или ссылку t.me/…';

/**
 * Блок связи с покупателями. Контакт — общий (продавец/менеджер/бот); храним
 * чистый username, на blur/save нормализуем `@user` / `t.me/user` → `user`. 12 §4.3.
 */
export default function CommunicationBlock({ store, suggestedUsername, onSave }: Props) {
  const [handle, setHandle] = useState(store.supportHandle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const trimmed = handle.trim();
  const isEmpty = trimmed === '';
  const normalized = normalizeTelegramUsername(handle);
  const valid = isEmpty || normalized.valid;
  const draftValue = isEmpty ? '' : normalized.username;
  const isDirty = valid && draftValue !== store.supportHandle;

  const handleBlur = () => {
    if (isEmpty) {
      setError(null);
      return;
    }
    if (!normalized.valid) {
      setError(INVALID_MESSAGE);
      return;
    }
    setHandle(normalized.username);
    setError(null);
  };

  const prefill = () => {
    setHandle(suggestedUsername);
    setError(null);
  };

  const clear = () => {
    setHandle('');
    setError(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`https://t.me/${draftValue}`);
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // клипборд недоступен — молча игнорируем
    }
  };

  const save = async () => {
    if (saving) return;
    if (!valid) {
      setError(INVALID_MESSAGE);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const patch: StoreProfilePatch = {};
      if (draftValue !== store.supportHandle) patch.supportHandle = draftValue;
      await onSave(patch);
      setHandle(draftValue);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div className="card__title">Связь с покупателями</div>
      <p style={styles.hint}>
        Контакт для связи: продавец, менеджер или бот. Покупатель откроет диалог по кнопке.
      </p>

      <div style={styles.inputRow}>
        <span style={styles.icon} aria-hidden="true">
          <Send size={18} />
        </span>
        <input
          type="text"
          aria-label="Контакт для связи"
          placeholder="@username или t.me/username"
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            setError(null);
          }}
          onBlur={handleBlur}
          style={styles.input}
        />
        {handle ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Очистить контакт"
            style={styles.clearButton}
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={prefill}
        disabled={saving || !suggestedUsername}
        style={{ ...styles.prefill, ...(suggestedUsername ? null : styles.prefillDisabled) }}
      >
        {suggestedUsername ? `Подставить мой @${suggestedUsername}` : 'Подставить мой @username'}
      </button>

      {valid && draftValue ? (
        <div style={styles.previewRow}>
          <span style={styles.preview}>
            Ссылка для покупателей:{' '}
            <a
              href={`https://t.me/${draftValue}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Открыть контакт в Telegram"
              style={styles.link}
            >
              t.me/{draftValue}
            </a>
          </span>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label="Копировать контакт"
            style={styles.copyButton}
          >
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" style={styles.error}>
          {error}
        </div>
      ) : null}

      <BlockSaveButton visible={isDirty} saving={saving} onClick={save} />
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { fontSize: 12, color: 'var(--color-text-secondary, #8E8E93)', margin: '0 0 10px' },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 12px',
    borderRadius: 14,
    border: '2px solid #EEE',
    background: '#FFFFFF',
  },
  icon: { display: 'flex', color: '#2AABEE' },
  input: {
    flex: 1,
    padding: '12px 0',
    border: 'none',
    outline: 'none',
    fontSize: 16,
    fontWeight: 600,
    background: 'transparent',
    color: '#000',
  },
  prefill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    padding: '8px 12px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--color-input-bg, #F2F2F7)',
    color: '#6C5DD3',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  prefillDisabled: { color: 'var(--color-text-secondary, #8E8E93)', cursor: 'default' },
  clearButton: {
    display: 'flex',
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-secondary, #8E8E93)',
    cursor: 'pointer',
    padding: 4,
  },
  previewRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  preview: { fontSize: 12, color: 'var(--color-text-secondary, #8E8E93)' },
  link: { color: '#2AABEE', fontWeight: 700, textDecoration: 'none' },
  copyButton: {
    flexShrink: 0,
    border: 'none',
    background: 'var(--color-input-bg, #F2F2F7)',
    color: '#6C5DD3',
    borderRadius: 10,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  error: { marginTop: 8, color: '#FF3B30', fontSize: 13 },
};

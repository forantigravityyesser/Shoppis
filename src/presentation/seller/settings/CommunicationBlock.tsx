import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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

/**
 * Блок связи с покупателями. Контакт — общий (продавец/менеджер/бот); храним
 * чистый username, на blur/save нормализуем `@user` / `t.me/user` → `user`. 12 §4.3.
 */
export default function CommunicationBlock({ store, suggestedUsername, onSave }: Props) {
  const { t } = useTranslation();
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
      setError(t('seller.settings.communication.invalid'));
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
      setError(t('seller.settings.communication.invalid'));
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
      <div className="card__title">{t('seller.settings.communication.title')}</div>
      <p style={styles.hint}>{t('seller.settings.communication.hint')}</p>

      <div style={styles.inputRow}>
        <span style={styles.icon} aria-hidden="true">
          <Send size={18} />
        </span>
        <input
          type="text"
          aria-label={t('seller.settings.communication.inputAria')}
          placeholder={t('seller.settings.communication.placeholder')}
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
            aria-label={t('seller.settings.communication.clearAria')}
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
        {suggestedUsername
          ? t('seller.settings.communication.prefillWith', { username: suggestedUsername })
          : t('seller.settings.communication.prefillGeneric')}
      </button>

      {valid && draftValue ? (
        <div style={styles.previewRow}>
          <span style={styles.preview}>
            {t('seller.settings.communication.linkLabel')}{' '}
            <a
              href={`https://t.me/${draftValue}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('seller.settings.communication.openAria')}
              style={styles.link}
            >
              t.me/{draftValue}
            </a>
          </span>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={t('seller.settings.communication.copyAria')}
            style={styles.copyButton}
          >
            {copied ? t('common.copied') : t('common.copy')}
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

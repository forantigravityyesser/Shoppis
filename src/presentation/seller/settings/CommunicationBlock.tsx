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
      <p className="settings-hint">{t('seller.settings.communication.hint')}</p>

      <div className="settings-input-row">
        <span className="settings-input-row__icon" aria-hidden="true">
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
          className="settings-input-row__input"
        />
        {handle ? (
          <button
            type="button"
            onClick={clear}
            aria-label={t('seller.settings.communication.clearAria')}
            className="settings-input-row__clear"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={prefill}
        disabled={saving || !suggestedUsername}
        className={`settings-prefill${suggestedUsername ? '' : ' settings-prefill--disabled'}`}
      >
        {suggestedUsername
          ? t('seller.settings.communication.prefillWith', { username: suggestedUsername })
          : t('seller.settings.communication.prefillGeneric')}
      </button>

      {valid && draftValue ? (
        <div className="settings-preview-row">
          <span className="settings-preview">
            {t('seller.settings.communication.linkLabel')}{' '}
            <a
              href={`https://t.me/${draftValue}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('seller.settings.communication.openAria')}
              className="settings-link"
            >
              t.me/{draftValue}
            </a>
          </span>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={t('seller.settings.communication.copyAria')}
            className="settings-copy"
          >
            {copied ? t('common.copied') : t('common.copy')}
          </button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="settings-block-error">
          {error}
        </div>
      ) : null}

      <BlockSaveButton visible={isDirty} saving={saving} onClick={save} />
    </section>
  );
}

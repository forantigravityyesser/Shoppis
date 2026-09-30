import { useState } from 'react';
import { currencySymbol } from '../../../domain/constants/currencies';
import { STORE_CURRENCIES, STORE_LANGUAGES } from '../../../domain/rules/store-settings-rules';
import type { Store, StoreCurrency, StoreLanguage } from '../../../domain/models/store';
import type { StoreProfilePatch } from '../../../application/contracts/store';
import SegmentedControl from './components/SegmentedControl';
import BlockSaveButton from './components/BlockSaveButton';

interface Props {
  store: Store;
  onSave: (patch: StoreProfilePatch) => Promise<void>;
}

const CURRENCY_OPTIONS = STORE_CURRENCIES.map((code) => ({
  value: code,
  label: `${code} (${currencySymbol(code)})`,
}));

const LANGUAGE_OPTIONS: Array<{ value: StoreLanguage; label: string }> = STORE_LANGUAGES.map(
  (code) => ({ value: code, label: code === 'ru' ? 'Русский' : 'English' }),
);

/**
 * Блок локализации: валюта и язык. Draft локально; в БД уходят только изменённые
 * поля этого блока. 12 §7.
 */
export default function LocalizationBlock({ store, onSave }: Props) {
  const [currency, setCurrency] = useState<StoreCurrency>(store.currencyCode);
  const [language, setLanguage] = useState<StoreLanguage>(store.language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencyChanged = currency !== store.currencyCode;
  const languageChanged = language !== store.language;
  const isDirty = currencyChanged || languageChanged;

  const save = async () => {
    if (saving) return;
    const patch: StoreProfilePatch = {};
    if (currencyChanged) patch.currency = currency;
    if (languageChanged) patch.language = language;

    setSaving(true);
    setError(null);
    try {
      await onSave(patch);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div className="card__title">Локализация</div>

      <div style={styles.field}>
        <span style={styles.label}>Валюта</span>
        <SegmentedControl
          options={CURRENCY_OPTIONS}
          value={currency}
          ariaLabel="Валюта"
          onChange={(value) => {
            setCurrency(value);
            setError(null);
          }}
        />
      </div>

      <div style={styles.field}>
        <span style={styles.label}>Язык</span>
        <SegmentedControl
          options={LANGUAGE_OPTIONS}
          value={language}
          ariaLabel="Язык"
          onChange={(value) => {
            setLanguage(value);
            setError(null);
          }}
        />
      </div>

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
  field: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary, #8E8E93)' },
  error: { marginTop: 8, color: '#FF3B30', fontSize: 13 },
};

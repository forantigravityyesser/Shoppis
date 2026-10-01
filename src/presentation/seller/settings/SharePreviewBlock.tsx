import { useEffect, useRef, useState } from 'react';
import { Copy, Eye } from 'lucide-react';

interface Props {
  /** Публичная ссылка на витрину (построена по `public_id`). */
  url: string;
  /** Предпросмотр становится доступен после появления публичной витрины (S-08). */
  previewEnabled?: boolean;
  onPreview?: () => void;
  /**
   * Показывать ли кнопку предпросмотра. На отдельном экране Share
   * предпросмотр скрыт — у него есть своя строка в Settings Hub.
   */
  showPreview?: boolean;
}

/**
 * Read-only блок «Поделиться»: ссылка на витрину и её копирование.
 * Без dirty/save — значение формируется из `public_id` и статуса магазина. 12 §7.
 */
export default function SharePreviewBlock({
  url,
  previewEnabled = false,
  onPreview,
  showPreview = true,
}: Props) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // клипборд недоступен — молча игнорируем
    }
  };

  return (
    <section className="card">
      <div className="card__title">Поделиться</div>
      <p style={styles.hint}>Ссылка на витрину для покупателей.</p>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Открыть витрину"
        style={styles.link}
      >
        {url}
      </a>

      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label="Копировать ссылку"
          style={{ ...styles.button, ...styles.copyButton }}
        >
          <Copy size={16} />
          {copied ? 'Скопировано' : 'Копировать'}
        </button>

        {showPreview ? (
          <button
            type="button"
            onClick={onPreview}
            disabled={!previewEnabled}
            aria-label="Предпросмотр магазина"
            style={{
              ...styles.button,
              ...styles.previewButton,
              ...(previewEnabled ? null : styles.buttonDisabled),
            }}
          >
            <Eye size={16} />
            Предпросмотр
          </button>
        ) : null}
      </div>

      {showPreview && !previewEnabled ? (
        <div style={styles.note}>Предпросмотр станет доступен после запуска витрины.</div>
      ) : null}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { fontSize: 12, color: 'var(--color-text-secondary, #8E8E93)', margin: '0 0 10px' },
  link: {
    display: 'block',
    fontSize: 13,
    fontWeight: 700,
    color: '#2AABEE',
    textDecoration: 'none',
    wordBreak: 'break-all',
  },
  actions: { display: 'flex', gap: 8, marginTop: 12 },
  button: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '12px',
    borderRadius: 12,
    border: 'none',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  copyButton: { background: '#6C5DD3', color: '#FFFFFF' },
  previewButton: { background: 'var(--color-input-bg, #F2F2F7)', color: '#1A1A2E' },
  buttonDisabled: { opacity: 0.55, cursor: 'default' },
  note: { marginTop: 8, fontSize: 12, color: 'var(--color-text-secondary, #8E8E93)' },
};

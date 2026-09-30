import { useRef } from 'react';

interface Props {
  /** Публичный URL или локальный blob-URL предпросмотра; пусто — нет баннера. */
  previewUrl: string;
  busy: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}

/** Загрузка/замена баннера магазина с предпросмотром. */
export default function BannerUploader({ previewUrl, busy, onPick, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (file: File | undefined) => {
    if (file) onPick(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={styles.container}>
      {previewUrl ? (
        <div style={styles.previewWrap}>
          <label style={styles.previewLabel}>
            <img src={previewUrl} alt="Баннер магазина" style={styles.image} decoding="async" />
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleChange(e.target.files?.[0])}
              style={styles.hiddenInput}
              aria-label="Заменить баннер"
            />
          </label>
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            aria-label="Убрать баннер"
            style={styles.clearButton}
          >
            ✕
          </button>
        </div>
      ) : (
        <label style={styles.emptyLabel}>
          <span style={{ fontSize: 24, lineHeight: 1 }}>🖼️</span>
          <span style={{ fontSize: 13, color: '#666' }}>Добавить баннер магазина</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleChange(e.target.files?.[0])}
            style={styles.hiddenInput}
            aria-label="Добавить баннер"
          />
        </label>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: '100%', marginBottom: 12 },
  previewWrap: {
    position: 'relative',
    width: '100%',
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewLabel: { display: 'block', width: '100%', height: '100%', cursor: 'pointer' },
  image: { width: '100%', height: '100%', objectFit: 'cover' },
  clearButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
  },
  emptyLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 160,
    borderRadius: 16,
    border: '2px dashed #DDD',
    backgroundColor: '#F9F9F9',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  hiddenInput: { display: 'none' },
};

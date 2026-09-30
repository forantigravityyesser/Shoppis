interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Array<Option<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** Переключатель с сегментами (валюта/язык и т.п.). */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} style={styles.group}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            style={{
              ...styles.segment,
              ...(selected ? styles.segmentSelected : null),
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  group: {
    display: 'flex',
    gap: 6,
    padding: 4,
    borderRadius: 14,
    backgroundColor: 'var(--color-input-bg, #F2F2F7)',
  },
  segment: {
    flex: 1,
    padding: '10px 8px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-secondary, #8E8E93)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  segmentSelected: {
    background: '#FFFFFF',
    color: '#1A1A2E',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
};

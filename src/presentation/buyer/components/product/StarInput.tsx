import { Star } from 'lucide-react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  size?: number;
}

/** Интерактивный выбор оценки (5 звёзд): выбрал 4 → 4 заполнены, 5-я пустая. */
export default function StarInput({ value, onChange, size = 30 }: Props) {
  return (
    <span className="pd-star-input" role="radiogroup" aria-label="Оценка">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        return (
          <button
            key={n}
            type="button"
            className="pd-star-input__btn"
            aria-label={`${n} из 5`}
            aria-pressed={on}
            onClick={() => onChange(n)}
          >
            <Star
              size={size}
              strokeWidth={1.8}
              className={on ? 'pd-stars__icon--on' : ''}
              fill={on ? 'currentColor' : 'none'}
            />
          </button>
        );
      })}
    </span>
  );
}

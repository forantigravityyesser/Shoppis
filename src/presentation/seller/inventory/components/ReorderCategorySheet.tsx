import BottomSheet from '../../../shared/components/BottomSheet';

interface ReorderCategorySheetProps {
  open: boolean;
  categoryName: string;
  /** Общее число переставляемых (несистемных) категорий. */
  total: number;
  /** Текущая позиция 1..total. */
  currentPosition: number;
  onClose: () => void;
  /** Выбор новой позиции; применяется сразу. */
  onSelect: (position: number) => void;
}

/**
 * Выбор позиции категории в каталоге покупателя (1..N). Числа 1–4 окрашены
 * (быстрые категории витрины), остальные нейтральные. Выбор применяется сразу.
 * docs/17 §4 (CAT-07b).
 */
export default function ReorderCategorySheet({
  open,
  categoryName,
  total,
  currentPosition,
  onClose,
  onSelect,
}: ReorderCategorySheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="sheet__title">Порядок в каталоге</h2>
      <p className="reorder__subtitle">{categoryName}</p>
      <div className="reorder__grid" role="group" aria-label="Позиция в каталоге">
        {Array.from({ length: total }, (_, index) => index + 1).map((position) => (
          <button
            key={position}
            type="button"
            className={`reorder__num${position <= 4 ? ` reorder__num--${position}` : ''}${
              position === currentPosition ? ' reorder__num--active' : ''
            }`}
            aria-pressed={position === currentPosition}
            onClick={() => onSelect(position)}
          >
            {position}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

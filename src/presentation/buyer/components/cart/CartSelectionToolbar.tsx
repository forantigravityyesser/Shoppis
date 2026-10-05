interface Props {
  selectedCount: number;
  /** Все валидные позиции выбраны → контрол предлагает «Снять всё». */
  allSelected: boolean;
  onToggleAll: () => void;
  /** Идёт реконсиляция (пере-запрос проекции) — показываем индикатор. */
  updating?: boolean;
}

/**
 * Компактный selection-контрол над списком (docs/18 §16–§17). Selection выводится
 * из состояния Cart (не дублируется), «Выбрать все»/«Снять всё» переключает его.
 * `updating` — мягкий индикатор реконсиляции, не блокирует список (docs/18 §32).
 */
export default function CartSelectionToolbar({
  selectedCount,
  allSelected,
  onToggleAll,
  updating = false,
}: Props) {
  return (
    <div className="cart-toolbar" aria-busy={updating}>
      <span className="cart-toolbar__label">
        Выбрано {selectedCount}
        {updating ? (
          <span
            className="cart-spinner"
            role="status"
            aria-label="Обновление корзины"
            data-testid="cart-updating"
          />
        ) : null}
      </span>
      <button
        type="button"
        className="cart-toolbar__toggle"
        aria-pressed={allSelected}
        onClick={onToggleAll}
      >
        {allSelected ? 'Снять всё' : 'Выбрать все'}
      </button>
    </div>
  );
}

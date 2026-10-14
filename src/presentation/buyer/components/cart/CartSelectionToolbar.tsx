import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <div className="cart-toolbar" aria-busy={updating}>
      <span className="cart-toolbar__label">
        {t('buyer.cart.selection.selected', { count: selectedCount })}
        {updating ? (
          <span
            className="cart-spinner"
            role="status"
            aria-label={t('buyer.cart.selection.updatingAria')}
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
        {allSelected ? t('buyer.cart.selection.clearAll') : t('buyer.cart.selection.selectAll')}
      </button>
    </div>
  );
}

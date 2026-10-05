import { useEffect, useState } from 'react';
import BottomSheet from '../../shared/components/BottomSheet';
import type { StorefrontCatalogPriceBounds } from '../../../application/read-models/storefront-catalog';
import PriceRangeSlider from './PriceRangeSlider';

interface Props {
  open: boolean;
  bounds: StorefrontCatalogPriceBounds | null;
  currencySymbol: string;
  /** Применённые из URL значения (minor units); null — фильтр не задан. */
  appliedMin: number | null;
  appliedMax: number | null;
  onClose: () => void;
  /** Применяются по кнопке «Показать товары»; null — без ограничения. */
  onApply: (min: number | null, max: number | null) => void;
}

/**
 * Шит фильтров каталога. MVP: только цена (диапазон store-wide из bounds).
 * Значения держатся локально и применяются **только** по кнопке «Показать товары»
 * (никаких запросов на каждое движение слайдера). docs/17 §4 (CAT-09).
 * Наружу уходят только сужающие границы: если диапазон равен store-wide — null.
 */
export default function CatalogFilterSheet({
  open,
  bounds,
  currencySymbol,
  appliedMin,
  appliedMax,
  onClose,
  onApply,
}: Props) {
  const boundsMin = bounds?.minPrice ?? null;
  const boundsMax = bounds?.maxPrice ?? null;
  const hasBounds = boundsMin != null && boundsMax != null && boundsMax > boundsMin;

  const [valueMin, setValueMin] = useState(boundsMin ?? 0);
  const [valueMax, setValueMax] = useState(boundsMax ?? 0);

  useEffect(() => {
    if (!open || boundsMin == null || boundsMax == null) return;
    setValueMin(appliedMin ?? boundsMin);
    setValueMax(appliedMax ?? boundsMax);
  }, [open, boundsMin, boundsMax, appliedMin, appliedMax]);

  const reset = () => {
    setValueMin(boundsMin ?? 0);
    setValueMax(boundsMax ?? 0);
  };

  const apply = () => {
    if (!hasBounds || boundsMin == null || boundsMax == null) {
      onClose();
      return;
    }
    onApply(valueMin > boundsMin ? valueMin : null, valueMax < boundsMax ? valueMax : null);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="sheet__title">Фильтры</h2>

      {hasBounds ? (
        <div className="filter-block">
          <div className="filter-block__label">Цена</div>
          <PriceRangeSlider
            min={boundsMin as number}
            max={boundsMax as number}
            valueMin={valueMin}
            valueMax={valueMax}
            symbol={currencySymbol}
            onChangeMin={setValueMin}
            onChangeMax={setValueMax}
          />
        </div>
      ) : (
        <p className="filter-empty">Пока нет доступных цен для фильтра.</p>
      )}

      <div className="filter-actions">
        <button type="button" className="btn-ghost" onClick={reset} disabled={!hasBounds}>
          Сбросить
        </button>
        <button type="button" className="btn-primary" onClick={apply}>
          Показать товары
        </button>
      </div>
    </BottomSheet>
  );
}

import { useState } from 'react';
import BottomSheet from '../../shared/components/BottomSheet';
import type { StorefrontCatalogPriceBounds } from '../../../application/read-models/storefront-catalog';
import PriceRangeSlider from './PriceRangeSlider';

interface Props {
  open: boolean;
  bounds: StorefrontCatalogPriceBounds | null;
  /** Границы цен грузятся. */
  loading?: boolean;
  /** Границы цен не загрузились (отдельно от «нет цен»). */
  error?: string | null;
  onRetry?: () => void;
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
  loading = false,
  error = null,
  onRetry,
  currencySymbol,
  appliedMin,
  appliedMax,
  onClose,
  onApply,
}: Props) {
  const boundsMin = bounds?.minPrice ?? null;
  const boundsMax = bounds?.maxPrice ?? null;
  const hasBounds = boundsMin != null && boundsMax != null && boundsMax > boundsMin;

  /** Правка пользователя; null — ещё не трогал (берём applied / bounds). Без sync-effect. */
  const [valueMin, setValueMin] = useState<number | null>(null);
  const [valueMax, setValueMax] = useState<number | null>(null);

  const sliderMin = valueMin ?? appliedMin ?? boundsMin ?? 0;
  const sliderMax = valueMax ?? appliedMax ?? boundsMax ?? 0;

  const reset = () => {
    setValueMin(boundsMin ?? 0);
    setValueMax(boundsMax ?? 0);
  };

  const apply = () => {
    if (!hasBounds || boundsMin == null || boundsMax == null) {
      onClose();
      return;
    }
    onApply(sliderMin > boundsMin ? sliderMin : null, sliderMax < boundsMax ? sliderMax : null);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="sheet__title">Фильтры</h2>

      {loading ? (
        <p className="filter-status" role="status">
          Загрузка фильтра…
        </p>
      ) : error ? (
        <div className="filter-error" role="alert">
          <p className="filter-error__text">Не удалось загрузить фильтр цены</p>
          {onRetry ? (
            <button type="button" className="btn-ghost" onClick={onRetry}>
              Повторить
            </button>
          ) : null}
        </div>
      ) : hasBounds ? (
        <div className="filter-block">
          <div className="filter-block__label">Цена</div>
          <PriceRangeSlider
            min={boundsMin as number}
            max={boundsMax as number}
            valueMin={sliderMin}
            valueMax={sliderMax}
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

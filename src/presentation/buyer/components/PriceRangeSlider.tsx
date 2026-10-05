import { formatMoneyMinor } from '../../../domain/rules/product-rules';

interface Props {
  /** Нижняя граница диапазона (minor units). */
  min: number;
  /** Верхняя граница диапазона (minor units). */
  max: number;
  valueMin: number;
  valueMax: number;
  symbol: string;
  /** Шаг слайдера в minor units. */
  step?: number;
  onChangeMin: (value: number) => void;
  onChangeMax: (value: number) => void;
}

/**
 * Двойной слайдер цены (От/До) на двух нативных `<input type="range"`, наложенных
 * друг на друга: треки прозрачны, интерактивны только ползунки (pointer-events).
 * Кламп «от ≤ до» задан атрибутами min/max каждого input. Значения — minor units.
 * docs/17 §4 (CAT-09).
 */
export default function PriceRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  symbol,
  step = 100,
  onChangeMin,
  onChangeMax,
}: Props) {
  const range = max - min || 1;
  const leftPct = ((valueMin - min) / range) * 100;
  const rightPct = ((valueMax - min) / range) * 100;

  return (
    <div className="price-slider">
      <div className="price-slider__values">
        <span className="price-slider__value">{formatMoneyMinor(valueMin, symbol)}</span>
        <span className="price-slider__value">{formatMoneyMinor(valueMax, symbol)}</span>
      </div>
      <div className="price-slider__control">
        <div className="price-slider__track" aria-hidden />
        <div
          className="price-slider__fill"
          style={{ left: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%` }}
          aria-hidden
        />
        <input
          type="range"
          className="price-slider__input"
          min={min}
          max={valueMax}
          step={step}
          value={valueMin}
          onChange={(e) => onChangeMin(Number(e.target.value))}
          aria-label="Цена от"
        />
        <input
          type="range"
          className="price-slider__input"
          min={valueMin}
          max={max}
          step={step}
          value={valueMax}
          onChange={(e) => onChangeMax(Number(e.target.value))}
          aria-label="Цена до"
        />
      </div>
    </div>
  );
}

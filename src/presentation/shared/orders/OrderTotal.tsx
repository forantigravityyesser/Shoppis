import { formatMoneyMinor } from '../../../domain/rules/product-rules';

interface Props {
  totalMinor: number;
  currencySymbol: string;
  label?: string;
}

/** «Итого» одной строкой (без subtotal/shipping/tax — MVP, docs/22 §5.3). */
export default function OrderTotal({ totalMinor, currencySymbol, label = 'Итого' }: Props) {
  return (
    <div className="order-total" data-testid="order-total">
      <span className="order-total__label">{label}</span>
      <span className="order-total__value" data-testid="order-total-value">
        {formatMoneyMinor(totalMinor, currencySymbol)}
      </span>
    </div>
  );
}

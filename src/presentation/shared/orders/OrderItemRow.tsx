import type { OrderItemView } from '../../../application/read-models/order';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import { getInitial } from '../../../domain/rules/initial';
import SafeImage from '../components/SafeImage';

interface Props {
  item: OrderItemView;
  currencySymbol: string;
}

function variantLabel(item: OrderItemView): string | null {
  const parts = [item.variantNameSnapshot, item.variantValueSnapshot].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(' ') : null;
}

/** Строка позиции заказа (immutable snapshot) — купленный товар, вариант, кол-во, сумма. */
export default function OrderItemRow({ item, currencySymbol }: Props) {
  const variant = variantLabel(item);

  return (
    <div className="order-item" data-testid="order-item">
      <span className="order-item__media">
        <SafeImage
          src={item.productImageSnapshot}
          alt={item.productTitleSnapshot}
          className="order-item__img"
          fallback={
            <span className="order-item__placeholder" aria-hidden>
              {getInitial(item.productTitleSnapshot)}
            </span>
          }
        />
      </span>
      <div className="order-item__body">
        <span className="order-item__title">{item.productTitleSnapshot}</span>
        {variant ? <span className="order-item__variant">{variant}</span> : null}
        <span className="order-item__qty">
          {item.quantity} × {formatMoneyMinor(item.unitPriceMinor, currencySymbol)}
        </span>
      </div>
      <span className="order-item__line">{formatMoneyMinor(item.lineTotalMinor, currencySymbol)}</span>
    </div>
  );
}

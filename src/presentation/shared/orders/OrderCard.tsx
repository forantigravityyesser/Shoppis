import type { ReactNode } from 'react';
import type { OrderListItem, OrderPreviewItem } from '../../../application/read-models/order';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import OrderStatusBadge from './OrderStatusBadge';
import OrderPreviewItems from './OrderPreviewItems';
import { formatOrderDate } from './order-format';

interface Props {
  order: OrderListItem;
  /** Если задан — появляется кнопка «Подробнее» (переход в деталь). */
  onOpen?: (orderId: string) => void;
  /** Доп. строка под датой (например, имя покупателя в seller-списке). */
  subtitle?: string;
  /** Слот под карточкой (действия/подсказки). */
  footer?: ReactNode;
  detailsLabel?: string;
}

/** Краткая строка состава: «Первый товар и ещё N». */
function summaryText(items: OrderPreviewItem[], itemCount: number): string {
  if (items.length === 0) return '';
  const first = items[0].title;
  const rest = itemCount - 1;
  return rest > 0 ? `${first} и ещё ${rest}` : first;
}

/**
 * Карточка заказа в списке: номер, дата, статус, превью-состав, сумма и переход в
 * деталь (docs/22 §5.3). Без buyer/seller-логики — различия через
 * `subtitle`/`footer`/`onOpen`/`detailsLabel`.
 */
export default function OrderCard({
  order,
  onOpen,
  subtitle,
  footer,
  detailsLabel = 'Подробнее',
}: Props) {
  const { id, publicOrderNumber, status, createdAt, totalMinor, currencySymbol, itemCount } = order;
  const summary = summaryText(order.previewItems, itemCount);

  return (
    <article className="order-card" data-testid="order-card">
      <div className="order-card__body">
        <div className="order-card__head">
          <div className="order-card__meta">
            <span className="order-card__number">№ {publicOrderNumber}</span>
            <span className="order-card__date">{formatOrderDate(createdAt)}</span>
            {subtitle ? <span className="order-card__subtitle">{subtitle}</span> : null}
          </div>
          <OrderStatusBadge status={status} />
        </div>

        <div className="order-card__summary">
          <OrderPreviewItems previewItems={order.previewItems} itemCount={itemCount} />
          {summary ? <span className="order-card__summary-text">{summary}</span> : null}
        </div>

        <div className="order-card__foot">
          <div className="order-card__amount">
            <span className="order-card__amount-label">Сумма заказа</span>
            <span className="order-card__total">
              {formatMoneyMinor(totalMinor, currencySymbol)}
            </span>
          </div>
          {onOpen ? (
            <button
              type="button"
              className="order-card__details"
              onClick={() => onOpen(id)}
              aria-label={`Подробнее о заказе ${publicOrderNumber}`}
            >
              {detailsLabel}
            </button>
          ) : null}
        </div>
      </div>

      {footer ? <div className="order-card__footer">{footer}</div> : null}
    </article>
  );
}

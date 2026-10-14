import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
  /**
   * Цвет суммы (docs/25 §4.3): `earned` — полученные продажи (зелёный),
   * `potential` — потенциальные (жёлтый). Без значения — обычный цвет.
   */
  priceTone?: 'earned' | 'potential';
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
  detailsLabel,
  priceTone,
}: Props) {
  const { t } = useTranslation();
  const { id, publicOrderNumber, status, createdAt, totalMinor, currencySymbol, itemCount } = order;
  /** Краткая строка состава: «Первый товар и ещё N». */
  const firstItem: OrderPreviewItem | undefined = order.previewItems[0];
  const rest = itemCount - 1;
  const summary = !firstItem
    ? ''
    : rest > 0
      ? t('orders.card.moreItems', { first: firstItem.title, count: rest })
      : firstItem.title;
  const totalClass = `order-card__total${priceTone ? ` order-card__total--${priceTone}` : ''}`;

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
            <span className="order-card__amount-label">{t('orders.card.amountLabel')}</span>
            <span className={totalClass}>{formatMoneyMinor(totalMinor, currencySymbol)}</span>
          </div>
          {onOpen ? (
            <button
              type="button"
              className="order-card__details"
              onClick={() => onOpen(id)}
              aria-label={t('orders.card.detailsAria', { number: publicOrderNumber })}
            >
              {detailsLabel ?? t('orders.card.details')}
            </button>
          ) : null}
        </div>
      </div>

      {footer ? <div className="order-card__footer">{footer}</div> : null}
    </article>
  );
}

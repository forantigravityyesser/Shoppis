import type { ReactNode } from 'react';
import type { OrderDetails } from '../../../application/read-models/order';
import { refusalReasonLabel } from '../../../domain/constants/order-statuses';
import OrderStatusBadge from './OrderStatusBadge';
import OrderItemRow from './OrderItemRow';
import OrderDeliveryDetails from './OrderDeliveryDetails';
import OrderTotal from './OrderTotal';
import { formatOrderDateTime } from './order-format';

interface Props {
  order: OrderDetails;
  /**
   * Секция «Контакт» — собирается тонким view (buyer: `support_handle`; seller:
   * TG-снимок покупателя либо телефон). Shared не знает про actor.
   */
  contact?: ReactNode;
  /** Слот действий (ORD-08 — read-only; действия — ORD-09/10). */
  actions?: ReactNode;
}

/**
 * Общее содержимое детали заказа (docs/22 §5.3, ORD-08): статус/даты → товары →
 * доставка → итого → контакт. Только блоки из нашего домена: без subtotal/shipping/
 * tax/payment/tracking/ETA. Immutable snapshots; никакой actor-логики.
 */
export default function OrderDetailsContent({ order, contact, actions }: Props) {
  const received = order.deliveryOutcome === 'RECEIVED';
  // Safe-getter (docs/24 §2.4): неизвестный код причины не роняет рендер.
  const reason = order.refusalReasonCode ? refusalReasonLabel(order.refusalReasonCode) : null;

  return (
    <div className="order-detail" data-testid="order-detail">
      <section className="order-detail__section order-detail__status">
        <div className="order-detail__status-head">
          <span className="order-detail__meta">Статус заказа</span>
          <OrderStatusBadge status={order.status} />
        </div>
        <span className="order-detail__meta">Оформлен {formatOrderDateTime(order.createdAt)}</span>
        <span className="order-detail__meta">
          Обновлён {formatOrderDateTime(order.updatedAt)}
        </span>
        {received ? <span className="order-detail__note">Покупатель забрал заказ</span> : null}
        {order.status === 'REFUSED' && reason ? (
          <span className="order-detail__note order-detail__note--danger">
            Причина отказа: {reason}
          </span>
        ) : null}
      </section>

      <section className="order-detail__section">
        <div className="order-detail__section-head">
          <h2 className="order-detail__section-title">Товары</h2>
          <span className="order-detail__section-count">{order.items.length}</span>
        </div>
        <div className="order-items">
          {order.items.map((item, index) => (
            <OrderItemRow
              key={`${item.productTitleSnapshot}-${index}`}
              item={item}
              currencySymbol={order.currencySymbol}
            />
          ))}
        </div>
        <OrderTotal totalMinor={order.totalMinor} currencySymbol={order.currencySymbol} />
      </section>

      <section className="order-detail__section">
        <h2 className="order-detail__section-title">Доставка</h2>
        <OrderDeliveryDetails delivery={order.delivery} />
      </section>

      {contact ? (
        <section className="order-detail__section">
          <h2 className="order-detail__section-title">Контакт</h2>
          {contact}
        </section>
      ) : null}

      {actions ? <div className="order-detail__actions">{actions}</div> : null}
    </div>
  );
}

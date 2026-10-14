import { useTranslation } from 'react-i18next';
import type { OrderStatus } from '../../../domain/models/order';
import { orderStatusLabelKey } from '../../../domain/constants/order-statuses';

const STATUS_MODIFIER: Record<OrderStatus, string> = {
  NEW: 'order-badge--new',
  IN_TRANSIT: 'order-badge--transit',
  DELIVERED: 'order-badge--delivered',
  REFUSED: 'order-badge--refused',
  CANCELLED: 'order-badge--cancelled',
};

interface Props {
  status: OrderStatus;
  className?: string;
}

/** Цветной бейдж статуса заказа с RU-подписью (docs/22 §5.1). Общий для buyer/seller. */
export default function OrderStatusBadge({ status, className }: Props) {
  const { t } = useTranslation();
  // Safe-getters (docs/24 §2.4): неизвестный статус не роняет рендер.
  const modifier = status in STATUS_MODIFIER ? STATUS_MODIFIER[status] : '';
  return (
    <span
      className={`order-badge ${modifier}${className ? ` ${className}` : ''}`}
      data-testid="order-status-badge"
      data-status={status}
    >
      {t(orderStatusLabelKey(status))}
    </span>
  );
}

import { useTranslation } from 'react-i18next';
import type { OrderDelivery } from '../../../application/read-models/order';

interface Props {
  delivery: OrderDelivery;
}

const EMPTY = '—';

/** Доставка заказа из immutable snapshot: получатель, телефон, адрес. */
export default function OrderDeliveryDetails({ delivery }: Props) {
  const { t } = useTranslation();
  const rows: Array<{ label: string; value: string }> = [
    { label: t('orders.delivery.recipient'), value: delivery.fullName },
    { label: t('orders.delivery.phone'), value: delivery.phone },
    { label: t('orders.delivery.address'), value: delivery.address },
  ];

  return (
    <dl className="order-delivery" data-testid="order-delivery">
      {rows.map((row) => (
        <div className="order-delivery__row" key={row.label}>
          <dt className="order-delivery__label">{row.label}</dt>
          <dd className="order-delivery__value">{row.value || EMPTY}</dd>
        </div>
      ))}
    </dl>
  );
}

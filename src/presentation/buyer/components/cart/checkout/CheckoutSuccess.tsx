import { createPortal } from 'react-dom';
import { CircleCheckBig } from 'lucide-react';
import type { CheckoutResult } from '../../../../../application/contracts/checkout';
import { formatMoneyMinor } from '../../../../../domain/rules/product-rules';

interface Props {
  order: CheckoutResult | null;
  /** Было ли получено разрешение на сообщения бота в этом заказе. */
  notificationsGranted: boolean;
  currencySymbol: string;
  onClose: () => void;
}

/**
 * Экран успешного заказа (docs/18 §23–§26) — полноэкранный оверлей поверх навбара.
 * Заказ уже создан сервером; здесь только подтверждение и понятный след (номер/сумма).
 * Про уведомления говорим честно: если разрешения нет — статус в Telegram не придёт.
 */
export default function CheckoutSuccess({
  order,
  notificationsGranted,
  currencySymbol,
  onClose,
}: Props) {
  return createPortal(
    <div className="checkout-success" role="dialog" aria-modal="true" data-testid="checkout-success">
      <div className="checkout-success__card">
        <span className="checkout-success__icon" aria-hidden>
          <CircleCheckBig size={56} strokeWidth={1.8} />
        </span>
        <h2 className="checkout-success__title">Заказ принят!</h2>

        {order ? (
          <>
            <p className="checkout-success__row">
              Номер заказа: <b>{order.orderNumber}</b>
            </p>
            <p className="checkout-success__row">
              Сумма: <b>{formatMoneyMinor(order.totalMinor, currencySymbol)}</b>
            </p>
          </>
        ) : null}

        <p className="checkout-success__note">
          {notificationsGranted
            ? 'Мы отправили уведомление в Telegram — статус заказа придёт туда.'
            : 'Уведомления в Telegram отключены, поэтому статус заказа не придёт в чат.'}
        </p>

        <button type="button" className="checkout-success__btn" onClick={onClose}>
          Вернуться в магазин
        </button>
      </div>
    </div>,
    document.body,
  );
}

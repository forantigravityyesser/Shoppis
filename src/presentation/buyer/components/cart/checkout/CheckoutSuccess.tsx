import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BellRing, CircleCheckBig } from 'lucide-react';
import type { CheckoutResult } from '../../../../../application/contracts/checkout';
import { formatMoneyMinor } from '../../../../../domain/rules/product-rules';

interface Props {
  order: CheckoutResult | null;
  /** Было ли получено разрешение на сообщения бота. */
  notificationsGranted: boolean;
  /** Идёт запрос разрешения у Telegram (кнопка «Разрешить»). */
  notificationsPending: boolean;
  currencySymbol: string;
  /** Явное действие «Перейти к заказам». */
  onClose: () => void;
  /** Авто-закрытие по таймауту: просто скрыть модалку, оставаясь в корзине. */
  onDismiss: () => void;
  /** Запросить разрешение и дослать «Заказ принят» покупателю. */
  onEnableNotifications: () => void;
  /** Через сколько миллисекунд окно закрывается само. */
  autoCloseMs?: number;
  /** Авто-закрытие: включаем только когда согласие уже получено (не мешаем opt-in). */
  autoClose?: boolean;
}

/** Авто-скрытие окна успеха (никуда не перенаправляет — остаёмся в корзине). */
export const SUCCESS_AUTO_CLOSE_MS = 5000;

/**
 * Экран успешного заказа (docs/18 §23–§26) — полноэкранный оверлей поверх навбара.
 * Заказ уже создан сервером; здесь только подтверждение и понятный след (номер/сумма).
 * Про уведомления говорим честно: если разрешения нет — статус в Telegram не придёт.
 */
export default function CheckoutSuccess({
  order,
  notificationsGranted,
  notificationsPending,
  currencySymbol,
  onClose,
  onDismiss,
  onEnableNotifications,
  autoCloseMs = SUCCESS_AUTO_CLOSE_MS,
  autoClose = true,
}: Props) {
  // onDismiss через ref: перерисовки родителя не перезапускают таймер.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!autoClose) return;
    const timer = setTimeout(() => onDismissRef.current(), autoCloseMs);
    return () => clearTimeout(timer);
  }, [autoClose, autoCloseMs]);

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

        {notificationsGranted ? (
          <p className="checkout-success__note" data-testid="checkout-notify-on">
            Уведомления включены — «Заказ принят» и статусы доставки придут в Telegram.
          </p>
        ) : (
          <div className="checkout-success__notify">
            <span className="checkout-success__notify-icon" aria-hidden>
              <BellRing size={22} />
            </span>
            <p className="checkout-success__note">
              Включите уведомления, чтобы не пропустить «Заказ принят» и статусы доставки в
              Telegram.
            </p>
            <button
              type="button"
              className="checkout-success__allow"
              onClick={onEnableNotifications}
              disabled={notificationsPending}
            >
              {notificationsPending ? 'Запрашиваем…' : 'Разрешить уведомления'}
            </button>
          </div>
        )}

        <button type="button" className="checkout-success__btn" onClick={onClose}>
          Перейти к заказам
        </button>
      </div>
    </div>,
    document.body,
  );
}

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useOrderDetails } from '../../../application/hooks/useOrderDetails';
import { useOrderActions } from '../../../application/hooks/useOrderActions';
import { useOrdersRealtime } from '../../../application/hooks/useOrdersRealtime';
import { isCancellable } from '../../../domain/rules/order-rules';
import type { OrderStatus, RefusalReasonCode } from '../../../domain/models/order';
import { orderActionErrorMessage } from '../../shared/order-action-error';
import BackButton from '../../shared/components/BackButton';
import OrderDetailsContent from '../../shared/orders/OrderDetailsContent';
import OrderContactButton from '../../shared/orders/OrderContactButton';
import OrderActionBar, { type OrderAction } from '../../shared/orders/OrderActionBar';
import OrderConfirm from '../../shared/orders/OrderConfirm';
import OrderRefusalPicker from '../../shared/orders/OrderRefusalPicker';
import OrderSkeleton from '../../shared/orders/OrderSkeleton';
import OrderEmptyState from '../../shared/orders/OrderEmptyState';
import '../../shared/orders/orders.css';

type Flow = 'idle' | 'cancel' | 'refuse';

/**
 * Детали заказа продавца (docs/22 ORD-08/ORD-10). Read-only snapshot + 6 lifecycle-
 * действий через `useOrderActions` (единственный command-path `order-actions`):
 * `NEW→IN_TRANSIT`, `NEW→CANCELLED`, `IN_TRANSIT→DELIVERED`, `IN_TRANSIT→CANCELLED`
 * (warning: held останется), `DELIVERED→RECEIVED`, `DELIVERED→REFUSED` (reason обязателен).
 * Клиентские guard'ы — UX-подсказка; решает сервер по актуальному статусу.
 */
export default function SellerOrderDetailsView() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { order, loading, error, notFound, refetch } = useOrderDetails({
    scope: 'seller',
    orderId: orderId ?? null,
  });
  // Realtime: инвалидирует список и детали изменившегося заказа (docs/22 ORD-14).
  useOrdersRealtime({ scope: 'seller' });
  const actions = useOrderActions();
  const [flow, setFlow] = useState<Flow>('idle');
  const [actionError, setActionError] = useState<string | null>(null);

  const o = order;

  const run = async (fn: () => Promise<void>) => {
    setActionError(null);
    try {
      await fn();
      setFlow('idle');
    } catch (e) {
      setActionError(orderActionErrorMessage((e as Error).message));
      // Статус мог измениться на сервере — отражаем правду.
      refetch();
    }
  };

  const buildActions = (status: OrderStatus, id: string): OrderAction[] => {
    const transition = (toStatus: OrderStatus) => () =>
      void run(() => actions.transitionOrder({ orderId: id, toStatus }));
    const openCancel = () => {
      setActionError(null);
      setFlow('cancel');
    };

    switch (status) {
      case 'NEW':
        return [
          { key: 'transit', label: 'Передать в доставку', variant: 'primary', disabled: actions.isPending, onClick: transition('IN_TRANSIT') },
          { key: 'cancel', label: 'Отменить', variant: 'danger', disabled: actions.isPending, onClick: openCancel },
        ];
      case 'IN_TRANSIT':
        return [
          { key: 'deliver', label: 'Отметить доставленным', variant: 'primary', disabled: actions.isPending, onClick: transition('DELIVERED') },
          { key: 'cancel', label: 'Отменить', variant: 'danger', disabled: actions.isPending, onClick: openCancel },
        ];
      case 'DELIVERED':
        return [
          {
            key: 'received',
            label: 'Покупатель забрал',
            variant: 'primary',
            disabled: actions.isPending,
            onClick: () => void run(() => actions.recordDeliveryOutcome({ orderId: id, outcome: 'RECEIVED' })),
          },
          {
            key: 'refuse',
            label: 'Отказ',
            variant: 'danger',
            disabled: actions.isPending,
            onClick: () => {
              setActionError(null);
              setFlow('refuse');
            },
          },
        ];
      default:
        return [];
    }
  };

  const cancelText =
    o?.status === 'IN_TRANSIT'
      ? 'Отменить заказ? Остаток не вернётся автоматически — потребуется ручная сверка остатков.'
      : 'Отменить этот заказ?';

  const actionsAvailable = o ? isCancellable(o.status, 'seller') || o.status === 'DELIVERED' : false;

  const actionsNode =
    o && flow === 'cancel' ? (
      <OrderConfirm
        text={cancelText}
        confirmLabel="Отменить заказ"
        pending={actions.isPending}
        error={actionError}
        onConfirm={() => void run(() => actions.cancelOrder({ orderId: o.id, actor: 'seller' }))}
        onCancel={() => {
          setFlow('idle');
          setActionError(null);
        }}
      />
    ) : o && flow === 'refuse' ? (
      <OrderRefusalPicker
        pending={actions.isPending}
        error={actionError}
        onConfirm={(reason: RefusalReasonCode) =>
          void run(() =>
            actions.recordDeliveryOutcome({ orderId: o.id, outcome: 'REFUSED', reason }),
          )
        }
        onCancel={() => {
          setFlow('idle');
          setActionError(null);
        }}
      />
    ) : o && actionsAvailable ? (
      <OrderActionBar actions={buildActions(o.status, o.id)} />
    ) : undefined;

  const contact = o ? (
    o.contact.telegramUsername ? (
      <OrderContactButton username={o.contact.telegramUsername} label="Написать покупателю" />
    ) : (
      <p className="order-contact__note">Телефон: {o.delivery.phone || 'не указан'}</p>
    )
  ) : null;

  const body = loading ? (
    <OrderSkeleton variant="detail" />
  ) : error ? (
    <div className="orders-error" role="alert" data-testid="order-detail-error">
      <p className="orders-error__title">Не удалось загрузить заказ</p>
      <p className="orders-error__text">Проверьте соединение и попробуйте снова.</p>
      <button type="button" className="orders-retry" onClick={refetch}>
        Повторить
      </button>
    </div>
  ) : notFound || !o ? (
    <OrderEmptyState
      text="Заказ не найден"
      action={
        <button type="button" className="orders-retry" onClick={() => navigate('/seller/orders')}>
          К заказам
        </button>
      }
    />
  ) : (
    <OrderDetailsContent order={o} contact={contact} actions={actionsNode} />
  );

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/orders" />
        <h1 className="screen__title">{o ? `Заказ № ${o.publicOrderNumber}` : 'Заказ'}</h1>
      </div>
      {body}
    </div>
  );
}

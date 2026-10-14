import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useOrderDetails } from '../../../application/hooks/useOrderDetails';
import { useOrderActions } from '../../../application/hooks/useOrderActions';
import { useOrdersRealtime } from '../../../application/hooks/useOrdersRealtime';
import {
  isAwaitingDeliveryOutcome,
  isCancellable,
  nextAllowedStatus,
} from '../../../domain/rules/order-rules';
import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../../../domain/models/order';
import { orderActionErrorMessage } from '../../shared/order-action-error';
import BackButton from '../../shared/components/BackButton';
import { useSmartBack } from '../../shared/hooks/useSmartBack';
import OrderDetailsContent from '../../shared/orders/OrderDetailsContent';
import OrderContactButton from '../../shared/orders/OrderContactButton';
import OrderActionBar, { type OrderAction } from '../../shared/orders/OrderActionBar';
import OrderConfirm from '../../shared/orders/OrderConfirm';
import OrderRefusalPicker from '../../shared/orders/OrderRefusalPicker';
import OrderSkeleton from '../../shared/orders/OrderSkeleton';
import OrderEmptyState from '../../shared/orders/OrderEmptyState';
import OrderStatusTransitionOverlay, {
  type TransitionVisual,
} from '../../shared/orders/OrderStatusTransitionOverlay';
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
  const { t } = useTranslation();
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { order, loading, error, notFound, refetch } = useOrderDetails({
    scope: 'seller',
    orderId: orderId ?? null,
  });
  // Realtime: инвалидирует список и детали изменившегося заказа (docs/22 ORD-14).
  useOrdersRealtime({ scope: 'seller' });
  const actions = useOrderActions();
  const goBack = useSmartBack();
  const [flow, setFlow] = useState<Flow>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  // Целевое состояние запущенной смены статуса — показываем «подпись» и уходим в список.
  const [transitionVisual, setTransitionVisual] = useState<TransitionVisual | null>(null);

  const o = order;

  /** Подписи «продвижения» по целевому статусу линейного потока. 03 §16 */
  const advanceLabel = (status: OrderStatus): string => {
    switch (status) {
      case 'IN_TRANSIT':
        return t('seller.orders.advanceInTransit');
      case 'DELIVERED':
        return t('seller.orders.advanceDelivered');
      default:
        return t('seller.orders.advance');
    }
  };

  const runTransition = async (visual: TransitionVisual, fn: () => Promise<void>) => {
    setActionError(null);
    setTransitionVisual(visual);
    try {
      await fn();
      setFlow('idle');
      // Уход в список — только после того, как анимация отыграна (см. onComplete).
    } catch (e) {
      setTransitionVisual(null);
      setActionError(orderActionErrorMessage((e as Error).message));
      // Статус мог измениться на сервере — отражаем правду.
      refetch();
    }
  };

  const buildActions = (
    status: OrderStatus,
    id: string,
    deliveryOutcome: DeliveryOutcome | null,
  ): OrderAction[] => {
    const transition = (toStatus: 'IN_TRANSIT' | 'DELIVERED') => () =>
      void runTransition(toStatus, () => actions.transitionOrder({ orderId: id, toStatus }));
    const openCancel = () => {
      setActionError(null);
      setFlow('cancel');
    };

    const result: OrderAction[] = [];

    if (isAwaitingDeliveryOutcome(status, deliveryOutcome)) {
      // Результат вручения терминален: RECEIVED/REFUSED — только пока outcome
      // не зафиксирован (docs/24 §3.2), а не по одному статусу.
      result.push({
        key: 'received',
        label: t('seller.orders.received'),
        variant: 'primary',
        disabled: actions.isPending,
        onClick: () =>
          void runTransition('RECEIVED', () =>
            actions.recordDeliveryOutcome({ orderId: id, outcome: 'RECEIVED' }),
          ),
      });
      result.push({
        key: 'refuse',
        label: t('seller.orders.refuse'),
        variant: 'danger',
        disabled: actions.isPending,
        onClick: () => {
          setActionError(null);
          setFlow('refuse');
        },
      });
    } else {
      // Матрица переходов — из domain-rules (`nextAllowedStatus`), не дублируется
      // вручную во view (docs/24 §2.7 D6).
      const next = nextAllowedStatus(status);
      if (next) {
        result.push({
          key: 'advance',
          label: advanceLabel(next),
          variant: 'primary',
          disabled: actions.isPending,
          onClick: transition(next as 'IN_TRANSIT' | 'DELIVERED'),
        });
      }
    }

    if (isCancellable(status, 'seller')) {
      result.push({
        key: 'cancel',
        label: t('seller.orders.cancel'),
        variant: 'danger',
        disabled: actions.isPending,
        onClick: openCancel,
      });
    }

    return result;
  };

  const cancelText =
    o?.status === 'IN_TRANSIT'
      ? t('seller.orders.cancelTextInTransit')
      : t('seller.orders.cancelText');

  const actionsAvailable = o
    ? isCancellable(o.status, 'seller') || isAwaitingDeliveryOutcome(o.status, o.deliveryOutcome)
    : false;

  const actionsNode =
    o && flow === 'cancel' ? (
      <OrderConfirm
        text={cancelText}
        confirmLabel={t('seller.orders.cancelOrder')}
        pending={actions.isPending}
        error={actionError}
        onConfirm={() =>
          void runTransition('CANCELLED', () =>
            actions.cancelOrder({ orderId: o.id, actor: 'seller' }),
          )
        }
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
          void runTransition('REFUSED', () =>
            actions.recordDeliveryOutcome({ orderId: o.id, outcome: 'REFUSED', reason }),
          )
        }
        onCancel={() => {
          setFlow('idle');
          setActionError(null);
        }}
      />
    ) : o && actionsAvailable ? (
      <OrderActionBar actions={buildActions(o.status, o.id, o.deliveryOutcome)} />
    ) : undefined;

  const contact = o ? (
    o.contact.telegramUsername ? (
      <OrderContactButton
        username={o.contact.telegramUsername}
        label={t('seller.orders.writeBuyer')}
      />
    ) : (
      <p className="order-contact__note">
        {t('seller.orders.phone', {
          phone: o.delivery.phone || t('seller.orders.phoneNotSpecified'),
        })}
      </p>
    )
  ) : null;

  const body = loading ? (
    <OrderSkeleton variant="detail" />
  ) : error ? (
    <div className="orders-error" role="alert" data-testid="order-detail-error">
      <p className="orders-error__title">{t('seller.orders.loadError')}</p>
      <p className="orders-error__text">{t('orders.error.text')}</p>
      <button type="button" className="orders-retry" onClick={refetch}>
        {t('common.retry')}
      </button>
    </div>
  ) : notFound || !o ? (
    <OrderEmptyState
      text={t('seller.orders.notFound')}
      action={
        <button type="button" className="orders-retry" onClick={() => navigate('/seller/orders')}>
          {t('seller.orders.toOrders')}
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
        <h1 className="screen__title">
          {o ? t('seller.orders.orderNumber', { number: o.publicOrderNumber }) : t('seller.orders.order')}
        </h1>
      </div>
      {body}
      <OrderStatusTransitionOverlay
        key={transitionVisual ?? 'idle'}
        visual={transitionVisual}
        pending={actions.isPending}
        onComplete={() => {
          setTransitionVisual(null);
          goBack('/seller/orders');
        }}
      />
    </div>
  );
}

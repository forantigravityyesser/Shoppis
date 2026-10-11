import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useOrderDetails } from '../../../application/hooks/useOrderDetails';
import { useOrderActions } from '../../../application/hooks/useOrderActions';
import { useOrdersRealtime } from '../../../application/hooks/useOrdersRealtime';
import { isCancellable } from '../../../domain/rules/order-rules';
import { orderActionErrorMessage } from '../../shared/order-action-error';
import BackButton from '../../shared/components/BackButton';
import OrderDetailsContent from '../../shared/orders/OrderDetailsContent';
import OrderContactButton from '../../shared/orders/OrderContactButton';
import OrderActionBar from '../../shared/orders/OrderActionBar';
import OrderConfirm from '../../shared/orders/OrderConfirm';
import OrderSkeleton from '../../shared/orders/OrderSkeleton';
import OrderEmptyState from '../../shared/orders/OrderEmptyState';
import '../home.css';
import '../catalog.css';
import '../../shared/orders/orders.css';

/**
 * Детали заказа покупателя (docs/22 ORD-08/ORD-09). Read-only snapshot + действие
 * отмены `NEW → CANCELLED` (confirmation; единственный command-path — `order-actions`).
 * Inventory возвращает сервер (`0007`), UI не дублирует; после успеха React Query
 * инвалидирует detail+list (`useOrderActions`), поэтому здесь статус обновится сам.
 */
export default function OrderDetailsView() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { order, loading, error, notFound, refetch } = useOrderDetails({
    scope: 'buyer',
    orderId: orderId ?? null,
  });
  // Realtime: инвалидирует список и детали изменившегося заказа (docs/22 ORD-14).
  useOrdersRealtime({ scope: 'buyer' });
  const actions = useOrderActions();
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const cancellable = order ? isCancellable(order.status, 'buyer') : false;

  const handleCancel = async () => {
    if (!order) return;
    setActionError(null);
    try {
      await actions.cancelOrder({ orderId: order.id, actor: 'buyer' });
      setConfirming(false);
    } catch (e) {
      setActionError(orderActionErrorMessage((e as Error).message));
      // Статус мог измениться на сервере — обновляем деталь, чтобы UI отражал правду.
      refetch();
    }
  };

  const cancelAction =
    cancellable && confirming ? (
      <OrderConfirm
        text="Отменить этот заказ?"
        confirmLabel="Отменить заказ"
        pending={actions.isPending}
        error={actionError}
        onConfirm={handleCancel}
        onCancel={() => {
          setConfirming(false);
          setActionError(null);
        }}
      />
    ) : cancellable ? (
      <OrderActionBar
        actions={[
          {
            key: 'cancel',
            label: 'Отменить заказ',
            variant: 'danger',
            disabled: actions.isPending,
            onClick: () => {
              setActionError(null);
              setConfirming(true);
            },
          },
        ]}
      />
    ) : undefined;

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
  ) : notFound || !order ? (
    <OrderEmptyState
      text="Заказ не найден"
      action={
        <button type="button" className="orders-retry" onClick={() => navigate('/orders')}>
          К заказам
        </button>
      }
    />
  ) : (
    <OrderDetailsContent
      order={order}
      contact={
        <OrderContactButton
          username={order.contact.supportHandle}
          label="Написать продавцу"
          fallbackText="Продавец не указал контакт для связи."
        />
      }
      actions={cancelAction}
    />
  );

  return (
    <div className="home">
      <header className="catalog-header">
        <div className="catalog-header__left">
          <BackButton fallback="/orders" />
        </div>
        <h1 className="catalog-header__title">
          {order ? `Заказ № ${order.publicOrderNumber}` : 'Заказ'}
        </h1>
        <div className="catalog-header__actions" />
      </header>
      <div className="home-sheet orders-sheet">{body}</div>
    </div>
  );
}

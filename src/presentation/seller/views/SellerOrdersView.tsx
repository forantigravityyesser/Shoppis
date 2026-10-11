import { useNavigate, useSearchParams } from 'react-router';
import { useOrders } from '../../../application/hooks/useOrders';
import { useOrdersRealtime } from '../../../application/hooks/useOrdersRealtime';
import { useInfiniteScrollSentinel } from '../../buyer/hooks/useInfiniteScrollSentinel';
import BackButton from '../../shared/components/BackButton';
import OrderCard from '../../shared/orders/OrderCard';
import OrderStatusTabs from '../../shared/orders/OrderStatusTabs';
import OrderSkeleton from '../../shared/orders/OrderSkeleton';
import OrderEmptyState from '../../shared/orders/OrderEmptyState';
import {
  parseStatusFilterParam,
  withStatusFilterParam,
} from '../../shared/orders/order-filter';
import type { OrderStatusFilter } from '../../../application/read-models/order';
import '../../shared/orders/orders.css';

/** Per-tab пустые тексты (docs/22 ORD-07). */
const EMPTY_TEXT: Record<OrderStatusFilter, string> = {
  all: 'Заказов пока нет',
  NEW: 'Новых заказов нет',
  IN_TRANSIT: 'Заказов в пути нет',
  DELIVERED: 'Доставленных заказов пока нет',
  history: 'История заказов пуста',
};

/**
 * Заказы продавца (docs/22 ORD-07): табы-фильтр (URL `?status=` для шаринга/совместимости),
 * карточки заказов своего магазина с keyset infinite loading. Scope `seller`; сервер
 * авторизует владение магазином. Мутаций нет (actions — ORD-10).
 */
export default function SellerOrdersView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = parseStatusFilterParam(searchParams.get('status'));

  const { orders, loading, fetching, error, hasNextPage, fetchNextPage, refetch } = useOrders({
    scope: 'seller',
    statusFilter,
  });

  // Новый заказ покупателя и смена статуса приходят по realtime → инвалидация (docs/22 ORD-14).
  useOrdersRealtime({ scope: 'seller' });

  const sentinelRef = useInfiniteScrollSentinel({
    onLoadMore: fetchNextPage,
    enabled: hasNextPage && !fetching,
  });

  const setFilter = (value: OrderStatusFilter) => {
    setSearchParams(withStatusFilterParam(searchParams, value), { replace: true });
  };

  const body = loading ? (
    <OrderSkeleton variant="list" />
  ) : error ? (
    <div className="orders-error" role="alert" data-testid="orders-error">
      <p className="orders-error__title">Не удалось загрузить заказы</p>
      <p className="orders-error__text">Проверьте соединение и попробуйте снова.</p>
      <button type="button" className="orders-retry" onClick={refetch}>
        Повторить
      </button>
    </div>
  ) : orders.length === 0 ? (
    <OrderEmptyState text={EMPTY_TEXT[statusFilter]} />
  ) : (
    <>
      <div className="orders-list" data-testid="orders-list">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onOpen={(id) => navigate(`/seller/orders/${id}`)}
          />
        ))}
      </div>
      <div ref={sentinelRef} className="home-stream-sentinel" aria-hidden />
      {fetching ? (
        <div
          className="home-stream-loading"
          role="status"
          aria-label="Загрузка заказов"
          data-testid="orders-loading-more"
        >
          <span className="home-stream-spinner" aria-hidden />
        </div>
      ) : null}
    </>
  );

  return (
    <div className="screen">
      <div className="screen__header screen__header--row screen__header--center">
        <BackButton fallback="/seller/dashboard" />
        <h1 className="screen__title">Заказы</h1>
      </div>
      <OrderStatusTabs value={statusFilter} onChange={setFilter} />
      {body}
    </div>
  );
}

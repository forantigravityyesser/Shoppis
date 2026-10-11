import { useNavigate, useSearchParams } from 'react-router';
import { useStore } from '../../../application/store';
import { useOrders } from '../../../application/hooks/useOrders';
import { useOrdersRealtime } from '../../../application/hooks/useOrdersRealtime';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import CatalogHeader from '../components/CatalogHeader';
import OrderCard from '../../shared/orders/OrderCard';
import OrderStatusTabs from '../../shared/orders/OrderStatusTabs';
import OrderSkeleton from '../../shared/orders/OrderSkeleton';
import OrderEmptyState from '../../shared/orders/OrderEmptyState';
import {
  parseStatusFilterParam,
  withStatusFilterParam,
} from '../../shared/orders/order-filter';
import type { OrderStatusFilter } from '../../../application/read-models/order';
import '../home.css';
import '../catalog.css';
import '../../shared/orders/orders.css';

/** Per-tab пустые тексты (docs/22 ORD-06). */
const EMPTY_TEXT: Record<OrderStatusFilter, string> = {
  all: 'Заказов пока нет',
  NEW: 'Новых заказов нет',
  IN_TRANSIT: 'Заказов в пути нет',
  DELIVERED: 'Доставленных заказов пока нет',
  history: 'История заказов пуста',
};

/**
 * Заказы покупателя (docs/22 ORD-06): шапка (назад/название/профиль) + табы-фильтр +
 * карточки заказов с keyset infinite loading. Данные — `useOrders` (React Query);
 * авторизация и scope — серверные. Мутаций нет (только просмотр/переход в деталь).
 */
export default function OrdersView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const serverUser = useStore((s) => s.serverUser);
  // Фильтр в URL (`?status=`) — источник истины: сохраняется при back из детали (ORD-11).
  const statusFilter = parseStatusFilterParam(searchParams.get('status'));

  const setFilter = (value: OrderStatusFilter) => {
    setSearchParams(withStatusFilterParam(searchParams, value), { replace: true });
  };

  const { orders, loading, fetching, error, hasNextPage, fetchNextPage, refetch } = useOrders({
    scope: 'buyer',
    statusFilter,
  });

  // Изменения заказов приходят по realtime → инвалидация React Query (docs/22 ORD-14).
  useOrdersRealtime({ scope: 'buyer' });

  const sentinelRef = useInfiniteScrollSentinel({
    onLoadMore: fetchNextPage,
    enabled: hasNextPage && !fetching,
  });

  const header = (
    <CatalogHeader
      title="Заказы"
      buyerAvatarUrl={serverUser?.photoUrl ?? null}
      buyerName={serverUser?.firstName ?? ''}
      onProfile={() => navigate('/account')}
    />
  );

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
          <OrderCard key={order.id} order={order} onOpen={(id) => navigate(`/orders/${id}`)} />
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
    <div className="home">
      {header}
      <div className="home-sheet orders-sheet">
        <OrderStatusTabs value={statusFilter} onChange={setFilter} />
        {body}
      </div>
    </div>
  );
}

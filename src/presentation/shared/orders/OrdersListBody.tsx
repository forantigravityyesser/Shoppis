import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import OrderCard from './OrderCard';
import OrderSkeleton from './OrderSkeleton';
import OrderEmptyState from './OrderEmptyState';
import type { OrderListItem, OrderStatusFilter } from '../../../application/read-models/order';

/** Per-tab пустые тексты (docs/22 ORD-06/ORD-07). Общие для buyer/seller. */
const ORDER_EMPTY_TEXT: Record<OrderStatusFilter, string> = {
  all: 'Заказов пока нет',
  NEW: 'Новых заказов нет',
  IN_TRANSIT: 'Заказов в пути нет',
  DELIVERED: 'Доставленных заказов пока нет',
  history: 'История заказов пуста',
};

interface Props {
  orders: OrderListItem[];
  loading: boolean;
  fetching: boolean;
  error: string | null;
  hasNextPage: boolean;
  statusFilter: OrderStatusFilter;
  /**
   * Текст при неактивном запросе (нет store/сессии) — отдельное состояние вместо
   * ложного «заказов нет» (docs/24 §2.7 D5). `null`/отсутствует — контекст есть.
   */
  disabledText?: string | null;
  onRetry: () => void;
  onLoadMore: () => void;
  onOpen: (id: string) => void;
}

/**
 * Тело списка заказов (docs/24 §2.7 D7 / ORD-HARDEN-09): единая разметка для
 * buyer (`OrdersView`) и seller (`SellerOrdersView`) — skeleton/error/empty/list,
 * ключ-точка на keyset-пагинацию. View отвечает только за шапку/табы/навигацию.
 */
export default function OrdersListBody({
  orders,
  loading,
  fetching,
  error,
  hasNextPage,
  statusFilter,
  disabledText,
  onRetry,
  onLoadMore,
  onOpen,
}: Props) {
  const sentinelRef = useInfiniteScrollSentinel({ onLoadMore, enabled: hasNextPage && !fetching });

  if (loading) return <OrderSkeleton variant="list" />;

  if (error) {
    return (
      <div className="orders-error" role="alert" data-testid="orders-error">
        <p className="orders-error__title">Не удалось загрузить заказы</p>
        <p className="orders-error__text">Проверьте соединение и попробуйте снова.</p>
        <button type="button" className="orders-retry" onClick={onRetry}>
          Повторить
        </button>
      </div>
    );
  }

  if (disabledText) return <OrderEmptyState text={disabledText} />;
  if (orders.length === 0) return <OrderEmptyState text={ORDER_EMPTY_TEXT[statusFilter]} />;

  return (
    <>
      <div className="orders-list" data-testid="orders-list">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} onOpen={onOpen} />
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
}

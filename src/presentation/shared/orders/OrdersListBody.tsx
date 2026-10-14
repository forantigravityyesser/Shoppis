import { useTranslation } from 'react-i18next';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import OrderCard from './OrderCard';
import OrderSkeleton from './OrderSkeleton';
import OrderEmptyState from './OrderEmptyState';
import type { OrderListItem, OrderStatusFilter } from '../../../application/read-models/order';

/** Per-tab ключи пустых текстов (docs/22 ORD-06/ORD-07). Общие для buyer/seller. */
const ORDER_EMPTY_KEYS = {
  all: 'orders.empty.all',
  NEW: 'orders.empty.NEW',
  IN_TRANSIT: 'orders.empty.IN_TRANSIT',
  DELIVERED: 'orders.empty.DELIVERED',
  history: 'orders.empty.history',
} as const satisfies Record<OrderStatusFilter, string>;

interface Props {
  orders: OrderListItem[];
  loading: boolean;
  fetching: boolean;
  error: string | null;
  hasNextPage: boolean;
  /** Таб-фильтр для дефолтного пустого текста (необязателен для не-таб списков). */
  statusFilter?: OrderStatusFilter;
  /** Переопределяет текст пустого состояния (например, секции продаж). */
  emptyText?: string;
  /** Цвет суммы в карточках (docs/25 §4.3): earned/potential. */
  priceTone?: 'earned' | 'potential';
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
  emptyText,
  priceTone,
  disabledText,
  onRetry,
  onLoadMore,
  onOpen,
}: Props) {
  const { t } = useTranslation();
  const sentinelRef = useInfiniteScrollSentinel({ onLoadMore, enabled: hasNextPage && !fetching });

  if (loading) return <OrderSkeleton variant="list" />;

  if (error) {
    return (
      <div className="orders-error" role="alert" data-testid="orders-error">
        <p className="orders-error__title">{t('orders.error.title')}</p>
        <p className="orders-error__text">{t('orders.error.text')}</p>
        <button type="button" className="orders-retry" onClick={onRetry}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (disabledText) return <OrderEmptyState text={disabledText} />;
  if (orders.length === 0) {
    const empty = emptyText ?? (statusFilter ? t(ORDER_EMPTY_KEYS[statusFilter]) : t('orders.empty.all'));
    return <OrderEmptyState text={empty} />;
  }

  return (
    <>
      <div className="orders-list" data-testid="orders-list">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} onOpen={onOpen} priceTone={priceTone} />
        ))}
      </div>
      <div ref={sentinelRef} className="home-stream-sentinel" aria-hidden />
      {fetching ? (
        <div
          className="home-stream-loading"
          role="status"
          aria-label={t('orders.loadingAria')}
          data-testid="orders-loading-more"
        >
          <span className="home-stream-spinner" aria-hidden />
        </div>
      ) : null}
    </>
  );
}

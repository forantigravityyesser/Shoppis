import { useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useOrders } from '../../../application/hooks/useOrders';
import { useOrdersRealtime } from '../../../application/hooks/useOrdersRealtime';
import { useStuck } from '../../shared/hooks/useStuck';
import BackButton from '../../shared/components/BackButton';
import OrdersListBody from '../../shared/orders/OrdersListBody';
import OrderStatusTabs from '../../shared/orders/OrderStatusTabs';
import OrderRefreshButton from '../../shared/orders/OrderRefreshButton';
import {
  parseStatusFilterParam,
  withStatusFilterParam,
} from '../../shared/orders/order-filter';
import type { OrderStatusFilter } from '../../../application/read-models/order';
import '../../shared/orders/orders.css';

/**
 * Заказы продавца (docs/22 ORD-07): табы-фильтр (URL `?status=` для шаринга/совместимости),
 * список (`OrdersListBody`, keyset infinite loading). Scope `seller`; сервер авторизует
 * владение магазином. Мутаций нет (actions — ORD-10).
 */
export default function SellerOrdersView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = parseStatusFilterParam(searchParams.get('status'));

  // «Назад» и «Обновить» живут в залипающем рейле: пока шапка видна — в шапке, при
  // скролле залипают в углах и становятся прозрачнее. Логика кнопок не меняется.
  const headerRef = useRef<HTMLDivElement>(null);
  const stuck = useStuck(headerRef);

  const { orders, loading, fetching, error, hasNextPage, fetchNextPage, refetch, refreshAll } =
    useOrders({
      scope: 'seller',
      statusFilter,
    });

  // Новый заказ покупателя и смена статуса приходят по realtime → инвалидация (docs/22 ORD-14).
  useOrdersRealtime({ scope: 'seller' });

  const setFilter = (value: OrderStatusFilter) => {
    setSearchParams(withStatusFilterParam(searchParams, value), { replace: true });
  };

  return (
    <div className="screen">
      <div className="sticky-rail sticky-rail--between">
        <BackButton
          fallback="/seller/dashboard"
          className={stuck ? 'back-btn--floating' : undefined}
        />
        <OrderRefreshButton
          onRefresh={refreshAll}
          refreshing={fetching}
          disabled={loading}
          className={stuck ? 'orders-refresh--floating' : undefined}
        />
      </div>
      <div className="screen__header screen__header--row screen__header--center" ref={headerRef}>
        <span className="screen__header-spacer" aria-hidden />
        <h1 className="screen__title">Заказы</h1>
        <span className="screen__header-spacer" aria-hidden />
      </div>
      <OrderStatusTabs
        value={statusFilter}
        onChange={setFilter}
        panelId="seller-orders-panel"
      />
      <div id="seller-orders-panel" role="tabpanel" aria-label="Заказы">
        <OrdersListBody
          orders={orders}
          loading={loading}
          fetching={fetching}
          error={error}
          hasNextPage={hasNextPage}
          statusFilter={statusFilter}
          onRetry={refetch}
          onLoadMore={fetchNextPage}
          onOpen={(id) => navigate(`/seller/orders/${id}`)}
        />
      </div>
    </div>
  );
}

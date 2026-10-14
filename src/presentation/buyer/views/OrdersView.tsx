import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useOrders } from '../../../application/hooks/useOrders';
import { useOrdersRealtime } from '../../../application/hooks/useOrdersRealtime';
import CatalogHeader from '../components/CatalogHeader';
import OrdersListBody from '../../shared/orders/OrdersListBody';
import OrderStatusTabs from '../../shared/orders/OrderStatusTabs';
import OrderRefreshButton from '../../shared/orders/OrderRefreshButton';
import {
  parseStatusFilterParam,
  withStatusFilterParam,
} from '../../shared/orders/order-filter';
import type { OrderStatusFilter } from '../../../application/read-models/order';
import '../home.css';
import '../catalog.css';
import '../../shared/orders/orders.css';

/**
 * Заказы покупателя (docs/22 ORD-06): шапка (назад/название/профиль) + табы-фильтр +
 * список (`OrdersListBody`, keyset infinite loading). Данные — `useOrders` (React Query);
 * авторизация и scope — серверные. Мутаций нет (только просмотр/переход в деталь).
 */
export default function OrdersView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const serverUser = useStore((s) => s.serverUser);
  // Фильтр в URL (`?status=`) — источник истины: сохраняется при back из детали (ORD-11).
  const statusFilter = parseStatusFilterParam(searchParams.get('status'));

  const setFilter = (value: OrderStatusFilter) => {
    setSearchParams(withStatusFilterParam(searchParams, value), { replace: true });
  };

  const {
    orders,
    loading,
    fetching,
    error,
    hasNextPage,
    disabledReason,
    fetchNextPage,
    refetch,
    refreshAll,
  } = useOrders({
    scope: 'buyer',
    statusFilter,
  });

  // Изменения заказов приходят по realtime → инвалидация React Query (docs/22 ORD-14).
  useOrdersRealtime({ scope: 'buyer' });

  /**
   * Отдельные состояния «запрос не пошёл» (docs/24 §2.7 D5 / ORD-HARDEN-05):
   * заказы store-scoped, поэтому без витрины это не «пустой список», а отсутствие
   * контекста.
   */
  const disabledText: Record<string, string> = {
    'no-store': t('buyer.orders.disabledNoStore'),
    'no-session': t('buyer.orders.disabledNoSession'),
    disabled: t('buyer.orders.disabled'),
  };

  const header = (
    <CatalogHeader
      title={t('buyer.orders.title')}
      buyerAvatarUrl={serverUser?.photoUrl ?? null}
      buyerName={serverUser?.firstName ?? ''}
      onProfile={() => navigate('/account')}
      trailing={
        <OrderRefreshButton onRefresh={refreshAll} refreshing={fetching} disabled={loading} />
      }
    />
  );

  return (
    <div className="home">
      {header}
      <div className="home-sheet orders-sheet">
        <OrderStatusTabs
          value={statusFilter}
          onChange={setFilter}
          panelId="orders-panel"
        />
        <div id="orders-panel" role="tabpanel" aria-label={t('buyer.orders.title')}>
          <OrdersListBody
            orders={orders}
            loading={loading}
            fetching={fetching}
            error={error}
            hasNextPage={hasNextPage}
            statusFilter={statusFilter}
            // Нет магазина/сессии → отдельное состояние, не «заказов нет» (D5).
            disabledText={disabledReason ? disabledText[disabledReason] : null}
            onRetry={refetch}
            onLoadMore={fetchNextPage}
            onOpen={(id) => navigate(`/orders/${id}`)}
          />
        </div>
      </div>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import type { SellerDashboardOrderCounts } from '../../../../application/read-models/seller-dashboard';
import type { OrderStatusFilter } from '../../../../application/read-models/order';
import DashboardCard from './DashboardCard';
import DashboardStat, { type DashboardStatTone } from './DashboardStat';

interface Props {
  counts: SellerDashboardOrderCounts;
  /** Клик по заголовку блока → все заказы. */
  onOpenAll: () => void;
  /** Клик по индикатору → список заказов в соответствующем статусе. */
  onOpenStatus: (filter: OrderStatusFilter) => void;
}

/**
 * Метод-мета: индикаторы блока «Заказы» (docs/25 §1.1). Значение — количество
 * заказов (зеркало табов экрана «Заказы»): Новые / В пути / Доставлено / История.
 */
const STATUS_STATS = [
  { key: 'new', labelKey: 'seller.dashboard.orders.stats.new', tone: 'new', filter: 'NEW' },
  {
    key: 'inTransit',
    labelKey: 'seller.dashboard.orders.stats.inTransit',
    tone: 'transit',
    filter: 'IN_TRANSIT',
  },
  {
    key: 'delivered',
    labelKey: 'seller.dashboard.orders.stats.delivered',
    tone: 'delivered',
    filter: 'DELIVERED',
  },
  {
    key: 'history',
    labelKey: 'seller.dashboard.orders.stats.history',
    tone: 'history',
    filter: 'history',
  },
] as const satisfies ReadonlyArray<{
  key: keyof SellerDashboardOrderCounts;
  labelKey: string;
  tone: DashboardStatTone;
  filter: OrderStatusFilter;
}>;

/** Блок «Заказы» главной продавца (docs/25 §4.1). */
export default function DashboardOrdersBlock({ counts, onOpenAll, onOpenStatus }: Props) {
  const { t } = useTranslation();
  return (
    <DashboardCard title={t('seller.dashboard.orders.title')} onTitleClick={onOpenAll}>
      <div className="dash-stats dash-stats--cards" data-testid="dashboard-orders-stats">
        {STATUS_STATS.map((stat) => {
          const label = t(stat.labelKey);
          return (
            <DashboardStat
              key={stat.key}
              label={label}
              value={counts[stat.key]}
              tone={stat.tone}
              ariaLabel={t('seller.dashboard.orders.aria', { label, value: counts[stat.key] })}
              onClick={() => onOpenStatus(stat.filter)}
            />
          );
        })}
      </div>
    </DashboardCard>
  );
}

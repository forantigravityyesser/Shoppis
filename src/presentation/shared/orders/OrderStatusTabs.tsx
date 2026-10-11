import { DEFAULT_ORDER_TABS, type OrderTab } from './order-tabs';
import type { OrderStatusFilter } from '../../../application/read-models/order';

interface Props {
  value: OrderStatusFilter;
  onChange: (value: OrderStatusFilter) => void;
  tabs?: OrderTab[];
  ariaLabel?: string;
}

/**
 * Табы-фильтр заказов. Принимает только доменный `OrderStatusFilter` и callback —
 * без actor-логики; метки/набор табов конфигурируются вызывающим view.
 */
export default function OrderStatusTabs({
  value,
  onChange,
  tabs = DEFAULT_ORDER_TABS,
  ariaLabel = 'Фильтр заказов',
}: Props) {
  return (
    <div className="order-tabs" role="tablist" aria-label={ariaLabel} data-testid="order-tabs">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`order-tabs__tab${active ? ' order-tabs__tab--active' : ''}`}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

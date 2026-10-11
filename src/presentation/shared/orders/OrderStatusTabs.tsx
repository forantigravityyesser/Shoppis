import { useRef, type KeyboardEvent } from 'react';
import { DEFAULT_ORDER_TABS, type OrderTab } from './order-tabs';
import type { OrderStatusFilter } from '../../../application/read-models/order';

interface Props {
  value: OrderStatusFilter;
  onChange: (value: OrderStatusFilter) => void;
  tabs?: OrderTab[];
  ariaLabel?: string;
  /** id панели контента (`role="tabpanel"`) для `aria-controls`. */
  panelId?: string;
}

/**
 * Табы-фильтр заказов (docs/24 §2.7 D9 / ORD-HARDEN-10). Принимает только
 * доменный `OrderStatusFilter` и callback — без actor-логики; метки/набор табов
 * конфигурируются вызывающим view.
 *
 * Клавиатурная семантика ARIA tabs: roving tabindex (в tab-порядке только активный
 * таб) + ArrowLeft/Right/Up/Down и Home/End переключают таб и переносят фокус.
 */
export default function OrderStatusTabs({
  value,
  onChange,
  tabs = DEFAULT_ORDER_TABS,
  ariaLabel = 'Фильтр заказов',
  panelId,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === value),
  );

  const selectByIndex = (index: number) => {
    const wrapped = (index + tabs.length) % tabs.length;
    const tab = tabs[wrapped];
    if (!tab) return;
    onChange(tab.value);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[wrapped]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        selectByIndex(activeIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        selectByIndex(activeIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        selectByIndex(0);
        break;
      case 'End':
        event.preventDefault();
        selectByIndex(tabs.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={listRef}
      className="order-tabs"
      role="tablist"
      aria-label={ariaLabel}
      data-testid="order-tabs"
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId || undefined}
            tabIndex={active ? 0 : -1}
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

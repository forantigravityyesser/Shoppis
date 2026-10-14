import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderTab } from './order-tabs';
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
  tabs,
  ariaLabel,
  panelId,
}: Props) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  /** Табы по умолчанию (docs/22 §5.1). «История» — фильтр-группировка, не статус. */
  const resolvedTabs: OrderTab[] = tabs ?? [
    { value: 'all', label: t('orders.tabs.all') },
    { value: 'NEW', label: t('orders.tabs.NEW') },
    { value: 'IN_TRANSIT', label: t('orders.tabs.IN_TRANSIT') },
    { value: 'DELIVERED', label: t('orders.tabs.DELIVERED') },
    { value: 'history', label: t('orders.tabs.history') },
  ];
  const resolvedAriaLabel = ariaLabel ?? t('orders.filterAria');
  const activeIndex = Math.max(
    0,
    resolvedTabs.findIndex((tab) => tab.value === value),
  );

  const selectByIndex = (index: number) => {
    const wrapped = (index + resolvedTabs.length) % resolvedTabs.length;
    const tab = resolvedTabs[wrapped];
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
        selectByIndex(resolvedTabs.length - 1);
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
      aria-label={resolvedAriaLabel}
      data-testid="order-tabs"
      onKeyDown={onKeyDown}
    >
      {resolvedTabs.map((tab) => {
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

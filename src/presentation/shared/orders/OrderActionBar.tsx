export interface OrderAction {
  key: string;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'default';
  disabled?: boolean;
}

interface Props {
  actions: OrderAction[];
}

/**
 * Панель действий заказа (docs/22 §5.8). Конфигурируется массивом действий от
 * тонкого view — `shared` не знает про actor-specific мутации (`canTransition`
 * и вызовы `useOrderActions` живут во view).
 */
export default function OrderActionBar({ actions }: Props) {
  if (actions.length === 0) return null;

  return (
    <div className="order-actions" data-testid="order-actions">
      {actions.map((action) => {
        const modifier =
          action.variant && action.variant !== 'default'
            ? ` order-actions__btn--${action.variant}`
            : '';
        return (
          <button
            key={action.key}
            type="button"
            className={`order-actions__btn${modifier}`}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}

/** Цветовой тон значения (docs/25 §1): статусы заказов, товары, продажи. */
export type DashboardStatTone =
  | 'neutral'
  | 'new'
  | 'transit'
  | 'delivered'
  | 'history'
  | 'active'
  | 'archive'
  | 'earned'
  | 'frozen';

interface Props {
  label: string;
  value: number | string;
  tone?: DashboardStatTone;
  /** Если задан — плитка кликабельна (кнопка). */
  onClick?: () => void;
  /** Доступное имя для кликабельной плитки (по умолчанию — `label`). */
  ariaLabel?: string;
}

/**
 * Индикатор-плитка с числовым значением и цветовым тоном (docs/25 §4).
 * Презентационный примитив; при `onClick` рендерится кнопкой (клик по индикатору).
 */
export default function DashboardStat({
  label,
  value,
  tone = 'neutral',
  onClick,
  ariaLabel,
}: Props) {
  const className = `dash-stat dash-stat--${tone}${onClick ? ' dash-stat--clickable' : ''}`;
  const content = (
    <>
      <span className="dash-stat__value">{value}</span>
      <span className="dash-stat__label">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-label={ariaLabel}
        data-testid="dashboard-stat"
        data-tone={tone}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} data-testid="dashboard-stat" data-tone={tone}>
      {content}
    </div>
  );
}

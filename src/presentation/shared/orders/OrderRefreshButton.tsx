import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  /** Перечитать все заказы (все статусы/табы), не всё приложение. */
  onRefresh: () => void;
  /** Идёт перечитывание — иконка вращается, кнопка заблокирована от повторного тапа. */
  refreshing?: boolean;
  disabled?: boolean;
  label?: string;
  /** Доп. классы на кнопку (например, «плавающее» состояние при залипании). */
  className?: string;
}

/**
 * Ручное обновление заказов (docs/22 ORD-14). Realtime — best-effort: если событие
 * потеряно (сокет был недоступен, экран уже открыт и т.п.), пользователь одним тапом
 * перечитывает ВСЕ статусы (все таб-фильтры) и детали — без перезагрузки приложения.
 */
export default function OrderRefreshButton({
  onRefresh,
  refreshing = false,
  disabled = false,
  label,
  className,
}: Props) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('orders.refreshLabel');
  return (
    <button
      type="button"
      className={`orders-refresh${className ? ` ${className}` : ''}`}
      onClick={onRefresh}
      disabled={disabled || refreshing}
      aria-label={resolvedLabel}
      data-testid="orders-refresh"
    >
      <RefreshCw
        size={18}
        className={`orders-refresh__icon${refreshing ? ' orders-refresh__icon--spinning' : ''}`}
        aria-hidden
      />
    </button>
  );
}

import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useHaptic } from '../../../application/hooks/useHaptic';
import { useSmartBack } from '../hooks/useSmartBack';

interface BackButtonProps {
  /**
   * Куда вернуться, если истории переходов нет
   * (прямой вход по ссылке, рефреш, первый экран сессии).
   */
  fallback: string;
  label?: string;
  /**
   * Перехватить навигацию (например, чтобы проиграть анимацию выхода слоя).
   * Если задан — вызывается вместо стандартного перехода; haptic сохраняется.
   */
  onClick?: () => void;
  /** Доп. классы на кнопку (например, «плавающее» состояние при залипании). */
  className?: string;
}

/**
 * Умный «назад» как в мобильных приложениях: шаг назад по истории роутера,
 * а при её отсутствии — безопасный fallback-маршрут вместо выхода из приложения.
 */
export default function BackButton({ fallback, label, onClick, className }: BackButtonProps) {
  const { t } = useTranslation();
  const { selectTick } = useHaptic();
  const goBack = useSmartBack();
  const resolvedLabel = label ?? t('common.back');

  const handleClick = () => {
    selectTick();
    if (onClick) {
      onClick();
      return;
    }
    goBack(fallback);
  };

  return (
    <button
      type="button"
      className={`back-btn${className ? ` ${className}` : ''}`}
      onClick={handleClick}
      aria-label={resolvedLabel}
    >
      <ArrowLeft size={20} />
    </button>
  );
}

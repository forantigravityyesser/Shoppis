import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { selectTick } from '../../../infrastructure/telegram/telegram-haptic';

interface BackButtonProps {
  /**
   * Куда вернуться, если истории переходов нет
   * (прямой вход по ссылке, рефреш, первый экран сессии).
   */
  fallback: string;
  label?: string;
}

/** Есть ли в истории роутера предыдущий переход, куда можно вернуться. */
function canGoBack(): boolean {
  if (typeof window === 'undefined' || !window.history.state) return false;
  const { idx } = window.history.state as { idx?: number };
  return typeof idx === 'number' && idx > 0;
}

/**
 * Умный «назад» как в мобильных приложениях: возвращает по истории роутера,
 * а при её отсутствии ведёт на безопасный fallback-маршрут вместо выхода из приложения.
 */
export default function BackButton({ fallback, label = 'Назад' }: BackButtonProps) {
  const navigate = useNavigate();

  const goBack = () => {
    selectTick();
    if (canGoBack()) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  };

  return (
    <button type="button" className="back-btn" onClick={goBack} aria-label={label}>
      <ArrowLeft size={20} />
    </button>
  );
}

import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useHaptic } from '../../../application/hooks/useHaptic';
import { canGoBack } from '../can-go-back';

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
}

/**
 * Умный «назад» как в мобильных приложениях: возвращает по истории роутера,
 * а при её отсутствии ведёт на безопасный fallback-маршрут вместо выхода из приложения.
 */
export default function BackButton({ fallback, label = 'Назад', onClick }: BackButtonProps) {
  const navigate = useNavigate();
  const { selectTick } = useHaptic();

  const goBack = () => {
    selectTick();
    if (onClick) {
      onClick();
      return;
    }
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

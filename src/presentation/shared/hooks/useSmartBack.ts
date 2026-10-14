import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { canGoBack } from '../can-go-back';

/**
 * Глобальный принцип «назад» для всего приложения: шаг назад по истории роутера,
 * а если истории нет (прямой вход по ссылке, рефреш, первый экран сессии) —
 * безопасный `fallback` вместо выхода из приложения.
 *
 * Единая точка правды: `BackButton`, слои (SocialLayer) и экраны с собственными
 * кнопками возврата используют один и тот же переход.
 */
export function useSmartBack(): (fallback: string) => void {
  const navigate = useNavigate();

  return useCallback(
    (fallback: string) => {
      if (canGoBack()) {
        navigate(-1);
      } else {
        navigate(fallback, { replace: true });
      }
    },
    [navigate],
  );
}

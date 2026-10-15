import { useState } from 'react';
import { useStore } from '../store';
import { useSellerTutorial } from './useSellerTutorial';

export interface DashboardTutorialCta {
  /** `resume` — продолжить прерванное обучение; `start` — пройти после отказа. */
  kind: 'resume' | 'start';
  onClick: () => void;
}

export interface DashboardTutorialController {
  /** Показывать welcome-шит (первое предложение, §4.1). */
  welcomeOpen: boolean;
  start: () => void;
  decline: () => void;
  /** CTA для чек-листа (или null, если ручной вход не нужен). */
  cta: DashboardTutorialCta | null;
}

/**
 * Orchestration обучения на главной (R5). Главная получает готовое состояние и
 * callbacks, не владея жизненным циклом welcome-шита и переходов; доменные
 * правила остаются в `useSellerTutorial`/`tutorial-rules`.
 */
export function useDashboardTutorial(): DashboardTutorialController {
  const currentStore = useStore((s) => s.currentStore);
  const tutorial = useSellerTutorial();
  const [welcomeClosed, setWelcomeClosed] = useState(false);

  // Предложение — только до первого решения и при наличии магазина (§4.1).
  const welcomeOpen = !!currentStore && tutorial.shouldOffer && !welcomeClosed;

  const withRevert = (action: () => Promise<void>) => {
    setWelcomeClosed(true);
    void action().catch(() => {
      // Не удалось записать состояние — не оставляем тупик, возвращаем предложение.
      setWelcomeClosed(false);
    });
  };

  const start = () => withRevert(() => tutorial.accept());
  const decline = () => withRevert(() => tutorial.decline());

  const openTutorial = () => {
    void tutorial.accept();
  };

  // Ручной вход в чек-листе: в процессе — «Продолжить», после отказа — «Пройти».
  const cta: DashboardTutorialCta | null = tutorial.interrupted
    ? { kind: 'resume', onClick: openTutorial }
    : tutorial.state.welcomeDecision === 'declined' && tutorial.state.status === 'not_started'
      ? { kind: 'start', onClick: openTutorial }
      : null;

  return { welcomeOpen, start, decline, cta };
}

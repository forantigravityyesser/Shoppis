import { useSellerTutorial } from './useSellerTutorial';

/**
 * Запуск обучения из presentation (R5): единая точка перехода `accept`. Экран
 * получает callback, не зная деталей контроллера обучения.
 */
export function useStartTutorial(): () => void {
  const tutorial = useSellerTutorial();
  return () => {
    void tutorial.accept();
  };
}

import { useEffect } from 'react';

/**
 * Браузерное предупреждение при закрытии/перезагрузке страницы, пока есть несохранённые изменения
 * (docs/23 §7.6, решение Q3). Внутренняя SPA-навигация не вызывает `beforeunload` — её
 * перехватывает сам экран через существующий механизм навигации и компонент подтверждения.
 */
export function useUnsavedChangesGuard(when: boolean): void {
  useEffect(() => {
    if (!when) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);
}

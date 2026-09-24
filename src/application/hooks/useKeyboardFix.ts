import { useEffect } from 'react';

/** Прячет нижнюю навигацию при открытой клавиатуре, скроллит к активному input */
export function useKeyboardFix(): void {
  useEffect(() => {
    const onFocusIn = () => document.body.classList.add('keyboard-is-open');
    const onFocusOut = () => document.body.classList.remove('keyboard-is-open');
    const viewport = window.visualViewport;
    const onResize = () => {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        active.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    viewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
      viewport?.removeEventListener('resize', onResize);
      document.body.classList.remove('keyboard-is-open');
    };
  }, []);
}

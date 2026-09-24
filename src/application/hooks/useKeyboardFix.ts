import { useEffect } from 'react';

/** Текстовый ввод — только он открывает клавиатуру и прячет нижнюю навигацию. */
function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Прячет нижнюю навигацию при открытой клавиатуре (фокус на текстовом поле), скроллит к активному input */
export function useKeyboardFix(): void {
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (isTextEntry(e.target)) document.body.classList.add('keyboard-is-open');
    };
    const onFocusOut = (e: FocusEvent) => {
      if (isTextEntry(e.target)) document.body.classList.remove('keyboard-is-open');
    };
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

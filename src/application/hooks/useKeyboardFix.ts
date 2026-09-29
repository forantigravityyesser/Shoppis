import { useEffect } from 'react';

/** Текстовый ввод — только он открывает клавиатуру и прячет нижнюю навигацию. */
function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Типы input, где `setSelectionRange` работает (каретку можно двигать). */
const CARET_INPUT_TYPES = new Set(['text', 'search', 'tel', 'url', 'password']);

function isCaretEditable(
  target: EventTarget | null,
): target is HTMLInputElement | HTMLTextAreaElement {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return CARET_INPUT_TYPES.has(target.type);
  return false;
}

/** Каретка — в конец значения: правка/удаление всегда с конца, а не с начала слова. */
function moveCaretToEnd(el: HTMLInputElement | HTMLTextAreaElement): void {
  const end = el.value.length;
  try {
    el.setSelectionRange(end, end);
  } catch {
    /* некоторые типы input не поддерживают выделение — игнорируем */
  }
}

/**
 * Мягкая клавиатура открывается только на тач-устройствах. На десктопе фокус на поле
 * прятал нижнюю навигацию, и при клике по кнопке (blur → возврат навбара) layout прыгал,
 * из-за чего первый клик не срабатывал. Поэтому на десктопе класс не трогаем.
 */
function hasCoarsePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

/** Прячет нижнюю навигацию при открытой клавиатуре (фокус на текстовом поле), скроллит к активному input */
export function useKeyboardFix(): void {
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (hasCoarsePointer() && isTextEntry(target)) document.body.classList.add('keyboard-is-open');
      if (isCaretEditable(target)) {
        // Ставим каретку в конец после того, как браузер применит позицию по тапу.
        const el = target;
        requestAnimationFrame(() => {
          if (document.activeElement === el) moveCaretToEnd(el);
        });
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      if (hasCoarsePointer() && isTextEntry(e.target)) document.body.classList.remove('keyboard-is-open');
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

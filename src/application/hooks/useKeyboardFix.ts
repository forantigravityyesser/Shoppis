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
 * Мягкая клавиатура сжимает visual viewport. Фокус сам по себе клавиатуру не
 * открывает: программный фокус (например, Home → Catalog с автфокусом поиска)
 * вешает фокус на поле, но клавиатуры нет. Поэтому состояние определяем по
 * реальному сжатию viewport — иначе навигация ложно прятала нижнюю панель,
 * и она не возвращалась, пока поле оставалось в фокусе.
 */
function isKeyboardOpen(): boolean {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return false;
  return window.innerHeight - vv.height > 120;
}

/** Прячет нижнюю навигацию при открытой клавиатуре, скроллит к активному input */
export function useKeyboardFix(): void {
  useEffect(() => {
    const sync = () => document.body.classList.toggle('keyboard-is-open', isKeyboardOpen());

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (isCaretEditable(target)) {
        // Ставим каретку в конец после того, как браузер применит позицию по тапу.
        const el = target;
        requestAnimationFrame(() => {
          if (document.activeElement === el) moveCaretToEnd(el);
        });
      }
      // Клавиатура открывается не мгновенно — проверим состояние после кадра.
      requestAnimationFrame(sync);
    };
    const onFocusOut = () => requestAnimationFrame(sync);

    const viewport = window.visualViewport;
    const onResize = () => {
      sync();
      if (!isKeyboardOpen()) return;
      const active = document.activeElement;
      if (isTextEntry(active)) {
        (active as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
    // На iOS при открытой клавиатуре скролл страницы не меняет размер viewport,
    // но сдвигает его — синхронизируем состояние и здесь.
    const onScroll = () => sync();

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    viewport?.addEventListener('resize', onResize);
    viewport?.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
      viewport?.removeEventListener('resize', onResize);
      viewport?.removeEventListener('scroll', onScroll);
      document.body.classList.remove('keyboard-is-open');
    };
  }, []);
}

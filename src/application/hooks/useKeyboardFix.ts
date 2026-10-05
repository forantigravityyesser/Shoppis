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

/** Мягкая клавиатура сжимает visual viewport (не всегда — см. shouldHideNav). */
function isKeyboardOpen(): boolean {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return false;
  return window.innerHeight - vv.height > 120;
}

/**
 * Прячем нижнюю навигацию, когда открыта клавиатура **или** выбран текстовый ввод.
 * Опора только на `visualViewport` ненадёжна в Telegram (WebView может ресайзить
 * layout, а не visual, либо не менять innerHeight) — поэтому фокус текстового поля
 * сам по себе является сигналом скрыть панель.
 */
function shouldHideNav(): boolean {
  return isKeyboardOpen() || isTextEntry(document.activeElement);
}

/**
 * Центрирует активное поле ввода в видимой области (глобальное правило для всех
 * страниц): центрируем относительно пересечения контейнера скролла и visualViewport,
 * поэтому поле не уезжает под клавиатуру.
 */
function centerActiveInput(): void {
  const el = document.activeElement;
  if (!isTextEntry(el)) return;
  const node = el as HTMLElement;
  const scroller = node.closest('.scrollable-content') as HTMLElement | null;

  if (!scroller) {
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }

  const vv = window.visualViewport;
  const rect = node.getBoundingClientRect();
  const scrollRect = scroller.getBoundingClientRect();
  const visibleTop = Math.max(scrollRect.top, vv ? vv.offsetTop : 0);
  const visibleBottom = vv
    ? Math.min(scrollRect.bottom, vv.offsetTop + vv.height)
    : scrollRect.bottom;
  const visibleCenter = (visibleTop + visibleBottom) / 2;
  const elementCenter = rect.top + rect.height / 2;
  const delta = elementCenter - visibleCenter;

  if (Math.abs(delta) > 4) {
    scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: 'smooth' });
  }
}

/** Прячет нижнюю навигацию и центрирует активное поле ввода при клавиатуре. */
export function useKeyboardFix(): void {
  useEffect(() => {
    const sync = () => document.body.classList.toggle('keyboard-is-open', shouldHideNav());

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (isCaretEditable(target)) {
        const el = target;
        // Каретку и центрирование — после того, как браузер применит позицию по тапу.
        requestAnimationFrame(() => {
          if (document.activeElement === el) moveCaretToEnd(el);
        });
      }
      // Клавиатура открывается не мгновенно — синхронизируем состояние после кадра.
      requestAnimationFrame(() => {
        sync();
        centerActiveInput();
      });
    };
    const onFocusOut = () => requestAnimationFrame(sync);

    const viewport = window.visualViewport;
    const onResize = () => {
      sync();
      centerActiveInput();
    };
    // На iOS при открытой клавиатуре скролл страницы не меняет размер viewport,
    // но сдвигает его — синхронизируем состояние и здесь.
    const onScroll = () => sync();

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    window.addEventListener('resize', onResize);
    viewport?.addEventListener('resize', onResize);
    viewport?.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', onResize);
      viewport?.removeEventListener('resize', onResize);
      viewport?.removeEventListener('scroll', onScroll);
      document.body.classList.remove('keyboard-is-open');
    };
  }, []);
}

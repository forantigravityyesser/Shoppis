// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardFix } from './useKeyboardFix';

let vv: EventTarget & { height: number; offsetTop: number };
let scrollSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.body.className = '';
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  scrollSpy = vi.fn();
  window.HTMLElement.prototype.scrollIntoView =
    scrollSpy as unknown as typeof window.HTMLElement.prototype.scrollIntoView;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  vv = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.className = '';
});

function mountInput(): HTMLInputElement {
  const input = document.createElement('input');
  document.body.appendChild(input);
  return input;
}

function fire(target: EventTarget, type: 'focusin' | 'focusout'): void {
  target.dispatchEvent(new FocusEvent(type, { bubbles: true }));
}

describe('useKeyboardFix', () => {
  it('прячет навигацию при фокусе текстового поля и возвращает после blur', () => {
    renderHook(() => useKeyboardFix());
    const input = mountInput();

    act(() => {
      input.focus();
      fire(input, 'focusin');
    });
    expect(document.body.classList.contains('keyboard-is-open')).toBe(true);

    // Уводим фокус на нетекстовый элемент (blur на поле): панель возвращается.
    const other = document.createElement('button');
    document.body.appendChild(other);
    act(() => {
      other.focus();
      fire(input, 'focusout');
    });
    expect(document.body.classList.contains('keyboard-is-open')).toBe(false);
  });

  it('центрирует активное поле ввода при фокусе', () => {
    renderHook(() => useKeyboardFix());
    const input = mountInput();

    act(() => {
      input.focus();
      fire(input, 'focusin');
    });
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('прячет навигацию, когда клавиатура сжимает viewport, и возвращает при закрытии', () => {
    renderHook(() => useKeyboardFix());
    const input = mountInput();
    input.focus();
    fire(input, 'focusin');

    vv.height = 500;
    act(() => {
      vv.dispatchEvent(new Event('resize'));
    });
    expect(document.body.classList.contains('keyboard-is-open')).toBe(true);

    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();
    fire(input, 'focusout');
    vv.height = 800;
    act(() => {
      vv.dispatchEvent(new Event('resize'));
    });
    expect(document.body.classList.contains('keyboard-is-open')).toBe(false);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardFix } from './useKeyboardFix';

let vv: EventTarget & { height: number };

beforeEach(() => {
  document.body.className = '';
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  vv = Object.assign(new EventTarget(), { height: 800 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.className = '';
});

function focusInput(): HTMLInputElement {
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  return input;
}

describe('useKeyboardFix', () => {
  it('не прячет навигацию при программном фокусе без открытия клавиатуры', () => {
    renderHook(() => useKeyboardFix());
    focusInput();
    expect(document.body.classList.contains('keyboard-is-open')).toBe(false);
  });

  it('прячет навигацию, когда клавиатура сжимает viewport, и возвращает при закрытии', () => {
    renderHook(() => useKeyboardFix());
    const input = focusInput();
    input.focus();

    vv.height = 500;
    act(() => {
      vv.dispatchEvent(new Event('resize'));
    });
    expect(document.body.classList.contains('keyboard-is-open')).toBe(true);

    vv.height = 800;
    act(() => {
      vv.dispatchEvent(new Event('resize'));
    });
    expect(document.body.classList.contains('keyboard-is-open')).toBe(false);
  });
});

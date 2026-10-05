// @vitest-environment jsdom
import type { PointerEvent as ReactPointerEvent } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useImageViewerGestures, type ImageViewerGestures } from './useImageViewerGestures';
import { DOUBLE_TAP_SCALE, MAX_SCALE } from './image-viewer-gestures';

function pointer(pointerId: number, x = 0, y = 0): ReactPointerEvent<HTMLDivElement> {
  return { pointerId, clientX: x, clientY: y } as unknown as ReactPointerEvent<HTMLDivElement>;
}

let now = 0;

beforeEach(() => {
  now = 1000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => vi.restoreAllMocks());

function tap(current: ImageViewerGestures) {
  act(() => {
    current.onPointerDown(pointer(1));
    current.onPointerUp(pointer(1));
  });
}

describe('useImageViewerGestures', () => {
  it('двойной тап: 1× → 2.5× → сброс к 1×', () => {
    const { result } = renderHook(() => useImageViewerGestures({ current: null }, 'a'));

    tap(result.current);
    now += 50;
    tap(result.current);
    expect(result.current.scale).toBe(DOUBLE_TAP_SCALE);

    now += 1000;
    tap(result.current);
    now += 50;
    tap(result.current);
    expect(result.current.scale).toBe(1);
    expect(result.current.position).toEqual({ x: 0, y: 0 });
  });

  it('одиночные тапы вне окна двойного тапа не меняют масштаб', () => {
    const { result } = renderHook(() => useImageViewerGestures({ current: null }, 'a'));
    tap(result.current);
    now += 1000;
    tap(result.current);
    expect(result.current.scale).toBe(1);
  });

  it('пинч увеличивает масштаб и клампится MAX_SCALE', () => {
    const { result } = renderHook(() => useImageViewerGestures({ current: null }, 'a'));

    act(() => {
      result.current.onPointerDown(pointer(1, 0, 0));
      result.current.onPointerDown(pointer(2, 100, 0));
    });
    act(() => result.current.onPointerMove(pointer(2, 300, 0)));
    expect(result.current.scale).toBe(3);

    act(() => result.current.onPointerMove(pointer(2, 900, 0)));
    expect(result.current.scale).toBe(MAX_SCALE);
  });

  it('панорамирование при увеличении смещает позицию', () => {
    const { result } = renderHook(() => useImageViewerGestures({ current: null }, 'a'));
    tap(result.current);
    now += 50;
    tap(result.current);
    expect(result.current.scale).toBe(DOUBLE_TAP_SCALE);

    act(() => {
      result.current.onPointerDown(pointer(1, 0, 0));
      result.current.onPointerMove(pointer(1, 30, 10));
    });
    // mediaRef в renderHook == null → clamp не применяется
    expect(result.current.position).toEqual({ x: 30, y: 10 });
  });

  it('смена resetKey сбрасывает зум и позицию', () => {
    const { result, rerender } = renderHook(
      ({ k }) => useImageViewerGestures({ current: null }, k),
      { initialProps: { k: 'a' } },
    );
    tap(result.current);
    now += 50;
    tap(result.current);
    expect(result.current.scale).toBe(DOUBLE_TAP_SCALE);

    rerender({ k: 'b' });
    expect(result.current.scale).toBe(1);
    expect(result.current.position).toEqual({ x: 0, y: 0 });
  });
});

import { describe, it, expect } from 'vitest';
import {
  DOUBLE_TAP_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  clamp,
  clampPosition,
  clampScale,
  doubleTapTarget,
  pinchScale,
} from './image-viewer-gestures';

describe('clamp / clampScale', () => {
  it('clamp держит значение в границах', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('clampScale держит [1, 4]', () => {
    expect(clampScale(0.5)).toBe(MIN_SCALE);
    expect(clampScale(2.5)).toBe(2.5);
    expect(clampScale(9)).toBe(MAX_SCALE);
  });
});

describe('clampPosition', () => {
  it('ограничивает смещение половиной переполнения', () => {
    // width 100, scale 2 → maxX = 50; height 200 → maxY = 100
    expect(clampPosition(80, 0, 100, 100, 2)).toEqual({ x: 50, y: 0 });
    expect(clampPosition(-80, 130, 100, 200, 2)).toEqual({ x: -50, y: 100 });
  });

  it('scale=1 → смещение обнуляется', () => {
    expect(clampPosition(30, 30, 100, 100, 1)).toEqual({ x: 0, y: 0 });
  });
});

describe('doubleTapTarget', () => {
  it('при 1× → 2.5×; при увеличении → сброс к 1×', () => {
    expect(doubleTapTarget(MIN_SCALE)).toBe(DOUBLE_TAP_SCALE);
    expect(doubleTapTarget(DOUBLE_TAP_SCALE)).toBe(MIN_SCALE);
  });
});

describe('pinchScale', () => {
  it('масштаб пропорционален расстоянию и клампится', () => {
    expect(pinchScale(1, 100, 200)).toBe(2);
    expect(pinchScale(1, 100, 1000)).toBe(MAX_SCALE);
  });

  it('нулевая стартовая дистанция не делит на ноль', () => {
    expect(pinchScale(1, 0, 50)).toBe(MAX_SCALE);
  });
});

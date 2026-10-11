import { describe, it, expect } from 'vitest';
import { CARD_ASPECT, cropRect, resolveCrop } from './image';

describe('cropRect', () => {
  it('ландшафтный исходник → режет бока по центру (4:5)', () => {
    const r = cropRect(1000, 500, CARD_ASPECT);
    expect(r).toEqual({ sx: 300, sy: 0, sw: 400, sh: 500 });
  });

  it('портретный исходник → режет верх/низ по центру (4:5)', () => {
    const r = cropRect(500, 1000, CARD_ASPECT);
    expect(r).toEqual({ sx: 0, sy: 188, sw: 500, sh: 625 });
  });

  it('точная пропорция → кроп без изменений', () => {
    const r = cropRect(800, 1000, CARD_ASPECT);
    expect(r).toEqual({ sx: 0, sy: 0, sw: 800, sh: 1000 });
  });

  it('квадрат (aspect = 1) → центральный квадрат по меньшей стороне', () => {
    expect(cropRect(1200, 800, 1)).toEqual({ sx: 200, sy: 0, sw: 800, sh: 800 });
    expect(cropRect(800, 1200, 1)).toEqual({ sx: 0, sy: 200, sw: 800, sh: 800 });
  });

  it('никогда не увеличивает исходник', () => {
    for (const [w, h] of [
      [1000, 500],
      [500, 1000],
      [640, 480],
      [300, 900],
    ]) {
      const r = cropRect(w, h, CARD_ASPECT);
      expect(r.sw).toBeLessThanOrEqual(w);
      expect(r.sh).toBeLessThanOrEqual(h);
      expect(r.sx).toBeGreaterThanOrEqual(0);
      expect(r.sy).toBeGreaterThanOrEqual(0);
    }
  });

  it('результат близок к целевой пропорции', () => {
    const r = cropRect(1000, 500, CARD_ASPECT);
    expect(r.sw / r.sh).toBeCloseTo(CARD_ASPECT, 2);
  });
});

describe('resolveCrop', () => {
  it('масштабирует ширину вывода из пропорции области (2.2:1 баннер)', () => {
    const r = resolveCrop(2000, 1000, { x: 100, y: 100, width: 1100, height: 500 }, 1100);
    expect(r).toEqual({ sx: 100, sy: 100, sw: 1100, sh: 500, outWidth: 1100, outHeight: 500 });
  });

  it('не увеличивает вывод шире исходной области', () => {
    const r = resolveCrop(1000, 1000, { x: 0, y: 0, width: 200, height: 200 }, 320);
    expect(r.outWidth).toBe(200);
    expect(r.outHeight).toBe(200);
  });

  it('клампит область, выходящую за границы исходника', () => {
    const r = resolveCrop(800, 600, { x: 700, y: 550, width: 400, height: 300 }, 320);
    expect(r.sw).toBe(400);
    expect(r.sh).toBe(300);
    expect(r.sx).toBe(400);
    expect(r.sy).toBe(300);
  });

  it('колбэчные координаты с плавающей точкой округляются', () => {
    const r = resolveCrop(1000, 1000, { x: 10.6, y: 20.4, width: 300.5, height: 300.5 }, 320);
    expect(r.sx).toBe(11);
    expect(r.sy).toBe(20);
    expect(r.sw).toBe(301);
    expect(r.sh).toBe(301);
  });

  it('сохраняет пропорцию вывода', () => {
    const r = resolveCrop(4000, 3000, { x: 0, y: 0, width: 2200, height: 1000 }, 1100);
    expect(r.outWidth / r.outHeight).toBeCloseTo(2.2, 2);
  });
});

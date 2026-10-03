import { describe, it, expect } from 'vitest';
import { CARD_ASPECT, cropRect } from './image';

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

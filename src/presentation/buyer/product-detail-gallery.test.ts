// @vitest-environment node
import { describe, it, expect } from 'vitest';
// @ts-expect-error -- node builtin; проект не ставит @types/node (тесты вне tsc-конфига)
import { readFileSync } from 'node:fs';

/**
 * Regression-guard для CSS галереи Product Detail. Причина: `object-fit: contain`
 * был заявлен (docs/14 §4.2) и один раз уже терялся из-за отката файла + сплита
 * CSS, после чего молча вернулся `cover` (обрезал портретные 4:5). Дешёвый тест
 * читает исходник и фиксирует инвариант.
 */
const css: string = readFileSync(new URL('./product-detail-gallery.css', import.meta.url), 'utf8');

function ruleBody(source: string, selector: string): string | null {
  const idx = source.indexOf(selector);
  if (idx < 0) return null;
  const open = source.indexOf('{', idx);
  if (open < 0) return null;
  const close = source.indexOf('}', open);
  if (close < 0) return null;
  return source.slice(open + 1, close);
}

describe('product-detail-gallery.css', () => {
  it('главное фото показывается целиком: object-fit: contain (без cover)', () => {
    const body = ruleBody(css, '.pd-gallery__main img');
    expect(body).not.toBeNull();
    expect(body).toMatch(/object-fit:\s*contain/);
    expect(body).not.toMatch(/object-fit:\s*cover/);
  });
});

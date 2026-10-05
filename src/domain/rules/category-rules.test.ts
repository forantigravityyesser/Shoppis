import { describe, expect, it } from 'vitest';
import { isSystemCategory, reorderCategories, resolveProductCategoryId } from './category-rules';
import { UNCATEGORIZED_ID } from '../constants/categories';

describe('isSystemCategory', () => {
  it('detects the system category only', () => {
    expect(isSystemCategory(UNCATEGORIZED_ID)).toBe(true);
    expect(isSystemCategory('cat-1')).toBe(false);
    expect(isSystemCategory(null)).toBe(false);
    expect(isSystemCategory(undefined)).toBe(false);
  });
});

describe('resolveProductCategoryId', () => {
  it('keeps a category that belongs to the store', () => {
    expect(resolveProductCategoryId('cat-1', ['cat-1', 'cat-2'])).toBe('cat-1');
  });

  it('falls back to system category for unknown/missing ids', () => {
    expect(resolveProductCategoryId('cat-x', ['cat-1'])).toBe(UNCATEGORIZED_ID);
    expect(resolveProductCategoryId(null, ['cat-1'])).toBe(UNCATEGORIZED_ID);
  });
});

describe('reorderCategories', () => {
  const list = [
    { id: 'a', sortOrder: 0 },
    { id: 'b', sortOrder: 1 },
    { id: 'c', sortOrder: 2 },
    { id: 'd', sortOrder: 3 },
  ];
  const ids = (items: Array<{ id: string }>) => items.map((i) => i.id);

  it('переставляет на позицию 1-based и перенумеровывает 0..N-1', () => {
    const result = reorderCategories(list, 'd', 1);
    expect(ids(result)).toEqual(['d', 'a', 'b', 'c']);
    expect(result.map((i) => i.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it('вставка в середину и в конец', () => {
    expect(ids(reorderCategories(list, 'a', 3))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(reorderCategories(list, 'a', 4))).toEqual(['b', 'c', 'd', 'a']);
  });

  it('clamp: позиция вне диапазона', () => {
    expect(ids(reorderCategories(list, 'b', 0))).toEqual(['b', 'a', 'c', 'd']);
    expect(ids(reorderCategories(list, 'b', 999))).toEqual(['a', 'c', 'd', 'b']);
  });

  it('неизвестный id → исходный список; вход не мутируется', () => {
    expect(reorderCategories(list, 'x', 1)).toBe(list);
    reorderCategories(list, 'd', 1);
    expect(ids(list)).toEqual(['a', 'b', 'c', 'd']);
  });
});

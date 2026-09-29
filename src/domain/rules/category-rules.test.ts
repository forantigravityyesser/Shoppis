import { describe, expect, it } from 'vitest';
import { isSystemCategory, resolveProductCategoryId } from './category-rules';
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

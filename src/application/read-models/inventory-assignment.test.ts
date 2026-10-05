import { describe, expect, it } from 'vitest';
import { UNCATEGORIZED_ID } from '../../domain/constants/categories';
import type { InventoryProductItem } from './inventory-view';
import { existingProductIdsForCategory } from './inventory-assignment';

function makeProduct(id: string, categoryId: string | null): InventoryProductItem {
  return {
    id,
    categoryId,
    title: id,
    imageUrl: null,
    emoji: '📦',
    priceMinor: 1000,
    currency: 'RUB',
    stockAvailable: 1,
    stockHeld: 0,
    stockState: 'in_stock',
    status: 'ACTIVE',
    rating: 0,
    reviewsCount: 0,
    questionsCount: 0,
  };
}

const USER_IDS = ['c1', 'c2'];

const PRODUCTS = [
  makeProduct('p1', 'c1'),
  makeProduct('p2', 'c1'),
  makeProduct('p3', 'c2'),
  makeProduct('p4', null),
  makeProduct('p5', 'deleted-category'),
  makeProduct('p6', UNCATEGORIZED_ID),
];

describe('existingProductIdsForCategory (docs/20 §8)', () => {
  it('возвращает товары целевой пользовательской категории', () => {
    expect(existingProductIdsForCategory(PRODUCTS, USER_IDS, 'c1')).toEqual(['p1', 'p2']);
  });

  it('null-категория → пустой список', () => {
    expect(existingProductIdsForCategory(PRODUCTS, USER_IDS, null)).toEqual([]);
  });

  it('системная категория собирает null/неизвестные/явные системные товары', () => {
    expect(existingProductIdsForCategory(PRODUCTS, USER_IDS, UNCATEGORIZED_ID)).toEqual([
      'p4',
      'p5',
      'p6',
    ]);
  });

  it('несуществующая категория → пустой список', () => {
    expect(existingProductIdsForCategory(PRODUCTS, USER_IDS, 'nope')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { mapSellerDashboardSummary } from './dashboard-mappers';

function summary(overrides: Record<string, unknown> = {}) {
  return {
    orders: { new: 2, inTransit: 1, delivered: 3, history: 4 },
    sales: { receivedMinor: 220000, frozenMinor: 80000 },
    inventory: { activeProducts: 10, archivedProducts: 2, activeCategories: 5 },
    ...overrides,
  };
}

describe('mapSellerDashboardSummary', () => {
  it('маппит заказы, продажи и инвентарь', () => {
    const s = mapSellerDashboardSummary(summary());
    expect(s).toEqual({
      orders: { new: 2, inTransit: 1, delivered: 3, history: 4 },
      sales: { receivedMinor: 220000, frozenMinor: 80000 },
      inventory: { activeProducts: 10, archivedProducts: 2, activeCategories: 5 },
    });
  });

  it('numeric-строки принимаются; отрицательные/NaN → 0', () => {
    const s = mapSellerDashboardSummary(
      summary({
        orders: { new: '5', inTransit: -1, delivered: 'x', history: null },
        sales: { receivedMinor: '100', frozenMinor: -9 },
        inventory: { activeProducts: '7', archivedProducts: undefined, activeCategories: 0 },
      }),
    );
    expect(s).toEqual({
      orders: { new: 5, inTransit: 0, delivered: 0, history: 0 },
      sales: { receivedMinor: 100, frozenMinor: 0 },
      inventory: { activeProducts: 7, archivedProducts: 0, activeCategories: 0 },
    });
  });

  it('отсутствующие секции → нули (не бросает)', () => {
    const s = mapSellerDashboardSummary({});
    expect(s).toEqual({
      orders: { new: 0, inTransit: 0, delivered: 0, history: 0 },
      sales: { receivedMinor: 0, frozenMinor: 0 },
      inventory: { activeProducts: 0, archivedProducts: 0, activeCategories: 0 },
    });
  });

  it('null / не-объект → null (нет валидной сводки)', () => {
    expect(mapSellerDashboardSummary(null)).toBeNull();
    expect(mapSellerDashboardSummary('nope')).toBeNull();
    expect(mapSellerDashboardSummary([])).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { mapSellerDashboardSummary } from './dashboard-mappers';

function summary(overrides: Record<string, unknown> = {}) {
  return {
    orders: { new: 2, inTransit: 1, delivered: 3, history: 4 },
    sales: { receivedMinor: 220000, frozenMinor: 80000 },
    inventory: {
      activeProducts: 10,
      archivedProducts: 2,
      activeCategories: 5,
      buyerAvailableProducts: 4,
    },
    growth: {
      firstOrderAt: '2026-01-01T00:00:00.000Z',
      firstShippedAt: null,
      firstCompletedAt: null,
    },
    ...overrides,
  };
}

describe('mapSellerDashboardSummary', () => {
  it('маппит заказы, продажи, инвентарь и growth', () => {
    const s = mapSellerDashboardSummary(summary());
    expect(s).toEqual({
      orders: { new: 2, inTransit: 1, delivered: 3, history: 4 },
      sales: { receivedMinor: 220000, frozenMinor: 80000 },
      inventory: {
        activeProducts: 10,
        archivedProducts: 2,
        activeCategories: 5,
        buyerAvailableProducts: 4,
      },
      growth: {
        firstOrderAt: '2026-01-01T00:00:00.000Z',
        firstShippedAt: null,
        firstCompletedAt: null,
      },
    });
  });

  it('numeric-строки принимаются; отрицательные/NaN → 0', () => {
    const s = mapSellerDashboardSummary(
      summary({
        orders: { new: '5', inTransit: -1, delivered: 'x', history: null },
        sales: { receivedMinor: '100', frozenMinor: -9 },
        inventory: {
          activeProducts: '7',
          archivedProducts: undefined,
          activeCategories: 0,
          buyerAvailableProducts: '2',
        },
      }),
    );
    expect(s).toEqual({
      orders: { new: 5, inTransit: 0, delivered: 0, history: 0 },
      sales: { receivedMinor: 100, frozenMinor: 0 },
      inventory: {
        activeProducts: 7,
        archivedProducts: 0,
        activeCategories: 0,
        buyerAvailableProducts: 2,
      },
      growth: {
        firstOrderAt: '2026-01-01T00:00:00.000Z',
        firstShippedAt: null,
        firstCompletedAt: null,
      },
    });
  });

  it('отсутствующие секции → нули/null (не бросает)', () => {
    const s = mapSellerDashboardSummary({});
    expect(s).toEqual({
      orders: { new: 0, inTransit: 0, delivered: 0, history: 0 },
      sales: { receivedMinor: 0, frozenMinor: 0 },
      inventory: {
        activeProducts: 0,
        archivedProducts: 0,
        activeCategories: 0,
        buyerAvailableProducts: 0,
      },
      growth: { firstOrderAt: null, firstShippedAt: null, firstCompletedAt: null },
    });
  });

  it('пустые/невалидные timestamp-факты → null', () => {
    const s = mapSellerDashboardSummary(
      summary({
        growth: { firstOrderAt: '', firstShippedAt: 123, firstCompletedAt: '2026-02-02' },
      }),
    );
    expect(s?.growth).toEqual({
      firstOrderAt: null,
      firstShippedAt: null,
      firstCompletedAt: '2026-02-02',
    });
  });

  it('null / не-объект → null (нет валидной сводки)', () => {
    expect(mapSellerDashboardSummary(null)).toBeNull();
    expect(mapSellerDashboardSummary('nope')).toBeNull();
    expect(mapSellerDashboardSummary([])).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  deliveryFromOrder,
  loadOrderNotificationData,
  mapOrderItems,
} from './order-context.js';

describe('mapOrderItems', () => {
  it('собирает снапшоты позиций (название + вариант)', () => {
    const items = mapOrderItems([
      {
        product_title_snapshot: 'Футболка',
        variant_name_snapshot: 'Размер',
        variant_value_snapshot: 'M',
        quantity: 2,
        line_total_minor: 200000,
      },
      {
        product_title_snapshot: 'Носки',
        variant_name_snapshot: null,
        variant_value_snapshot: '42',
        quantity: 1,
        line_total_minor: 50000,
      },
    ]);
    expect(items).toEqual([
      { title: 'Футболка', variantLabel: 'Размер M', quantity: 2, lineTotalMinor: 200000 },
      { title: 'Носки', variantLabel: '42', quantity: 1, lineTotalMinor: 50000 },
    ]);
  });

  it('не-массив/пусто → []', () => {
    expect(mapOrderItems(null)).toEqual([]);
    expect(mapOrderItems(undefined)).toEqual([]);
  });
});

describe('deliveryFromOrder', () => {
  it('извлекает снапшот доставки', () => {
    expect(
      deliveryFromOrder({
        buyer_full_name_snapshot: 'Иван',
        buyer_phone_snapshot: '+7',
        buyer_address_snapshot: 'Москва',
      }),
    ).toEqual({ fullName: 'Иван', phone: '+7', address: 'Москва' });
  });

  it('пустые поля → null', () => {
    expect(deliveryFromOrder(null)).toBeNull();
    expect(deliveryFromOrder({})).toBeNull();
  });
});

/** Stub SDK-клиента: `.from(table).select().eq().order()/.maybeSingle()`. */
function stubClient({ order = null, store = null, items = [] } = {}) {
  return {
    database: {
      from(table) {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: order, error: null }) }),
            }),
          };
        }
        if (table === 'stores') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: store, error: null }) }),
            }),
          };
        }
        // order_items
        return {
          select: () => ({
            eq: () => ({ order: async () => ({ data: items, error: null }) }),
          }),
        };
      },
    },
  };
}

describe('loadOrderNotificationData', () => {
  it('возвращает заказ, магазин и позиции', async () => {
    const client = stubClient({
      order: { store_id: 's1', buyer_user_id: 'u1' },
      store: { public_id: 'pid', owner_telegram_id: '42' },
      items: [{ product_title_snapshot: 'Товар', quantity: 1, line_total_minor: 100 }],
    });
    const { order, store, items } = await loadOrderNotificationData(client, 'o1');
    expect(order.store_id).toBe('s1');
    expect(store.public_id).toBe('pid');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Товар');
  });

  it('нет заказа → пустые значения, без падения', async () => {
    const { order, store, items } = await loadOrderNotificationData(stubClient(), 'o1');
    expect(order).toBeNull();
    expect(store).toBeNull();
    expect(items).toEqual([]);
  });
});

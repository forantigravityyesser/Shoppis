import { describe, expect, it } from 'vitest';
import { mapOrderDetails, mapOrderListPage, mapSalesListPage } from './order-mappers';

function listItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    publicOrderNumber: 'SH-1',
    status: 'NEW',
    createdAt: '2026-10-10T10:00:00Z',
    totalMinor: 220000,
    currencyCode: 'BYN',
    currencySymbol: 'Br',
    itemCount: 2,
    previewItems: [
      { imageUrl: 'https://img/a.jpg', title: 'Толстовка', variantLabel: 'Размер: 42', quantity: 1 },
      { imageUrl: null, title: 'Худи', variantLabel: null, quantity: 2 },
    ],
    ...overrides,
  };
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    publicOrderNumber: 'SH-1',
    status: 'DELIVERED',
    deliveryOutcome: 'RECEIVED',
    refusalReasonCode: null,
    currencyCode: 'BYN',
    currencySymbol: 'Br',
    subtotalMinor: 220000,
    totalMinor: 220000,
    createdAt: '2026-10-10T10:00:00Z',
    updatedAt: '2026-10-10T11:00:00Z',
    cancelledAt: null,
    completedAt: '2026-10-10T11:00:00Z',
    refusedAt: null,
    delivery: { fullName: 'Данила', phone: '+375257914112', address: 'Минск, Ленина 1' },
    contact: { supportHandle: 'Dnk_65', telegramUsername: null },
    items: [
      {
        productTitleSnapshot: 'Толстовка',
        productImageSnapshot: null,
        variantNameSnapshot: 'Размер:',
        variantValueSnapshot: '42-48',
        linkingAttributesSnapshot: [{ name: 'Цвет', value: 'Красный' }],
        quantity: 1,
        unitPriceMinor: 220000,
        lineTotalMinor: 220000,
      },
    ],
    ...overrides,
  };
}

describe('mapOrderListPage', () => {
  it('маппит заказ: номер, статус, деньги, валюту и preview', () => {
    const page = mapOrderListPage({ orders: [listItem()], nextCursor: 'c1' });
    expect(page.nextCursor).toBe('c1');
    expect(page.orders[0]).toMatchObject({
      id: 'o1',
      publicOrderNumber: 'SH-1',
      status: 'NEW',
      currencyCode: 'BYN',
      currencySymbol: 'Br',
      totalMinor: 220000,
      itemCount: 2,
    });
    expect(page.orders[0].previewItems).toHaveLength(2);
  });

  it('«+N»: itemCount может превышать число preview (маппер отдаёт оба)', () => {
    const page = mapOrderListPage({ orders: [listItem({ itemCount: 5 })], nextCursor: null });
    expect(page.orders[0].itemCount).toBe(5);
    expect(page.orders[0].previewItems).toHaveLength(2);
  });

  it('null-изображение и null-variantLabel сохраняются как null', () => {
    const page = mapOrderListPage({ orders: [listItem()], nextCursor: null });
    expect(page.orders[0].previewItems[1].imageUrl).toBeNull();
    expect(page.orders[0].previewItems[1].variantLabel).toBeNull();
  });

  it('numeric-строки денег/количеств принимаются; отрицательные → 0', () => {
    const page = mapOrderListPage({
      orders: [listItem({ totalMinor: '220000', itemCount: '3' })],
      nextCursor: null,
    });
    expect(page.orders[0]).toMatchObject({ totalMinor: 220000, itemCount: 3 });

    const negative = mapOrderListPage({ orders: [listItem({ totalMinor: -5 })], nextCursor: null });
    expect(negative.orders[0].totalMinor).toBe(0);
  });

  it('невалидная страница / не-массив orders → пустая страница', () => {
    expect(mapOrderListPage(null)).toEqual({ orders: [], nextCursor: null });
    expect(mapOrderListPage({ orders: 'nope' })?.orders).toEqual([]);
  });

  it('неизвестный status → безопасный fallback (docs/24 §2.4)', () => {
    const page = mapOrderListPage({ orders: [listItem({ status: 'WEIRD' })], nextCursor: null });
    expect(page.orders[0].status).toBe('NEW');
  });

  it('пустой символ → детерминированный fallback по currency_code (docs/24 §3.3)', () => {
    const page = mapOrderListPage({
      orders: [listItem({ currencyCode: 'BYN', currencySymbol: '' })],
      nextCursor: null,
    });
    expect(page.orders[0].currencySymbol).toBe('Br');
  });
});

describe('mapSalesListPage (docs/25 §3.2)', () => {
  it('маппит список и сумму всей группы', () => {
    const page = mapSalesListPage({
      orders: [listItem()],
      nextCursor: 'c1',
      totalMinor: 99000,
    });
    expect(page.totalMinor).toBe(99000);
    expect(page.nextCursor).toBe('c1');
    expect(page.orders[0].publicOrderNumber).toBe('SH-1');
  });

  it('невалидная проекция → пустая страница и 0', () => {
    expect(mapSalesListPage(null)).toEqual({ orders: [], nextCursor: null, totalMinor: 0 });
    expect(mapSalesListPage({ orders: 'nope', totalMinor: -1 })).toEqual({
      orders: [],
      nextCursor: null,
      totalMinor: 0,
    });
  });
});

describe('mapOrderDetails', () => {
  it('маппит snapshot позиций, доставку и контакт покупателя', () => {
    const d = mapOrderDetails(detail());
    expect(d).not.toBeNull();
    expect(d).toMatchObject({
      id: 'o1',
      status: 'DELIVERED',
      deliveryOutcome: 'RECEIVED',
      refusalReasonCode: null,
      subtotalMinor: 220000,
      totalMinor: 220000,
    });
    expect(d?.delivery).toEqual({
      fullName: 'Данила',
      phone: '+375257914112',
      address: 'Минск, Ленина 1',
    });
    expect(d?.contact.supportHandle).toBe('Dnk_65');
    expect(d?.items[0]).toMatchObject({
      productTitleSnapshot: 'Толстовка',
      productImageSnapshot: null,
      variantNameSnapshot: 'Размер:',
      variantValueSnapshot: '42-48',
      linkingAttributesSnapshot: [{ name: 'Цвет', value: 'Красный' }],
      quantity: 1,
      unitPriceMinor: 220000,
      lineTotalMinor: 220000,
    });
  });

  it('null supportHandle и null telegramUsername → null (контакт не задан)', () => {
    const d = mapOrderDetails(
      detail({ contact: { supportHandle: null, telegramUsername: null } }),
    );
    expect(d?.contact.supportHandle).toBeNull();
    expect(d?.contact.telegramUsername).toBeNull();
  });

  it('seller-проекция: telegramUsername заполнен, supportHandle null', () => {
    const d = mapOrderDetails(
      detail({ contact: { supportHandle: null, telegramUsername: 'buyer_x' } }),
    );
    expect(d?.contact.telegramUsername).toBe('buyer_x');
    expect(d?.contact.supportHandle).toBeNull();
  });

  it('refusalReasonCode и deliveryOutcome сохраняются как union-значения', () => {
    const d = mapOrderDetails(detail({ status: 'REFUSED', deliveryOutcome: 'REFUSED', refusalReasonCode: 'OTHER' }));
    expect(d?.deliveryOutcome).toBe('REFUSED');
    expect(d?.refusalReasonCode).toBe('OTHER');
  });

  it('null / битый ответ → null (единый safe not-found), не бросает', () => {
    expect(mapOrderDetails(null)).toBeNull();
    expect(mapOrderDetails('nope')).toBeNull();
  });

  it('неизвестные enum-значения → безопасный fallback (docs/24 §2.4)', () => {
    const d = mapOrderDetails(
      detail({ status: 'WEIRD', deliveryOutcome: 'NOPE', refusalReasonCode: 'MADE_UP_CODE' }),
    );
    expect(d?.status).toBe('NEW');
    expect(d?.deliveryOutcome).toBeNull();
    expect(d?.refusalReasonCode).toBeNull();
  });

  it('пустой символ → fallback по currency_code (docs/24 §3.3)', () => {
    const d = mapOrderDetails(detail({ currencyCode: 'RUB', currencySymbol: null }));
    expect(d?.currencySymbol).toBe('₽');
  });

  it('не-массив items → [] ; битые linking-атрибуты → []', () => {
    const d = mapOrderDetails(detail({ items: undefined }));
    expect(d?.items).toEqual([]);
    const d2 = mapOrderDetails(
      detail({ items: [{ productTitleSnapshot: 'X', linkingAttributesSnapshot: 'bad' }] }),
    );
    expect(d2?.items[0].linkingAttributesSnapshot).toEqual([]);
  });
});

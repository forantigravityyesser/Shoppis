// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeCheckout, fetchBuyerOrders, requestMessagesAccess, enableTelegramNotifications } =
  vi.hoisted(() => ({
    invokeCheckout: vi.fn(),
    fetchBuyerOrders: vi.fn(),
    requestMessagesAccess: vi.fn(),
    enableTelegramNotifications: vi.fn(),
  }));

vi.mock('../../composition/container', () => ({
  deps: () => ({
    i18n: { getAppLanguage: () => 'ru', setAppLanguage: () => {} },
    checkoutApi: { invokeCheckout },
    orderRepository: {
      fetchBuyerOrders,
      fetchStoreOrders: vi.fn(),
      fetchOrderItems: vi.fn(),
    },
    telegram: { requestMessagesAccess },
    notificationApi: { enableTelegramNotifications },
  }),
}));

import { useStore } from '../index';
import type { RecipientInfo } from '../../../domain/models/customer';

const RECIPIENT: RecipientInfo = {
  name: 'Иван Петров',
  phone: '+79001234567',
  address: 'Москва, ул. Ленина 1',
};

function seedCart(): void {
  useStore.setState({
    storeId: 'store-a',
    sessionToken: 'tok',
    serverUser: {
      id: 'u1',
      telegramUserId: '1',
      username: '',
      firstName: 'Иван',
      languageCode: 'ru',
      photoUrl: '',
    },
    cartByStore: {
      'store-a': [
        { productId: 'p1', productVariantId: 'v1', quantity: 2, price: 1000, selected: true },
        { productId: 'p2', productVariantId: 'v2', quantity: 1, price: 500, selected: false },
      ],
    },
    lastOrder: null,
    lastOrderId: null,
    ordersError: null,
  });
}

beforeEach(() => {
  invokeCheckout.mockReset();
  fetchBuyerOrders.mockReset();
  requestMessagesAccess.mockReset();
  enableTelegramNotifications.mockReset();
  fetchBuyerOrders.mockResolvedValue([]);
  seedCart();
});

describe('order-slice — checkout foundation', () => {
  it('placeOrder: сохраняет lastOrder, удаляет только оформленные позиции, обновляет заказы', async () => {
    invokeCheckout.mockResolvedValue({
      orderId: 'o1',
      orderNumber: 'SH-251005-ABC',
      totalMinor: 24000,
      currencyCode: 'USD',
    });

    const orderId = await useStore.getState().placeOrder(RECIPIENT);
    expect(orderId).toBe('o1');

    const s = useStore.getState();
    expect(s.lastOrder).toEqual({
      orderId: 'o1',
      orderNumber: 'SH-251005-ABC',
      totalMinor: 24000,
      currencyCode: 'USD',
    });
    expect(s.lastOrderId).toBe('o1');
    // Невыбранная позиция (p2/v2) остаётся в корзине, оформленная (p1/v1) удалена.
    expect(s.cartByStore['store-a']).toEqual([
      { productId: 'p2', productVariantId: 'v2', quantity: 1, price: 500, selected: false },
    ]);
    expect(fetchBuyerOrders).toHaveBeenCalledTimes(1);
  });

  it('placeOrder: сбой обновления списка заказов не делает успешный заказ ошибкой', async () => {
    invokeCheckout.mockResolvedValue({
      orderId: 'o2',
      orderNumber: 'SH-2',
      totalMinor: 24000,
      currencyCode: 'USD',
    });
    fetchBuyerOrders.mockRejectedValue(new Error('network'));

    await expect(useStore.getState().placeOrder(RECIPIENT)).resolves.toBe('o2');
    const s = useStore.getState();
    expect(s.lastOrder?.orderId).toBe('o2');
    expect(s.cartByStore['store-a']).toHaveLength(1);
    expect(s.cartByStore['store-a'][0].productId).toBe('p2');
  });

  it('placeOrder: ошибка → корзина сохраняется, ошибка зафиксирована, lastOrder пуст', async () => {
    invokeCheckout.mockRejectedValue(new Error('INSUFFICIENT_STOCK'));

    await expect(useStore.getState().placeOrder(RECIPIENT)).rejects.toThrow('INSUFFICIENT_STOCK');

    const s = useStore.getState();
    expect(s.cartByStore['store-a']).toHaveLength(2);
    expect(s.lastOrder).toBeNull();
    expect(s.ordersError).toBe('INSUFFICIENT_STOCK');
  });

  it('placeOrder: невалидный получатель не доходит до сервера', async () => {
    await expect(
      useStore.getState().placeOrder({ ...RECIPIENT, address: '   ' }),
    ).rejects.toThrow();
    expect(invokeCheckout).not.toHaveBeenCalled();
  });

  it('requestNotifications: согласие → фиксируется на сервере', async () => {
    requestMessagesAccess.mockResolvedValue(true);
    expect(await useStore.getState().requestNotifications()).toBe(true);
    expect(enableTelegramNotifications).toHaveBeenCalledWith('tok', undefined);
  });

  it('requestNotifications: orderId уходит для досыла заказа', async () => {
    requestMessagesAccess.mockResolvedValue(true);
    expect(await useStore.getState().requestNotifications('o1')).toBe(true);
    expect(enableTelegramNotifications).toHaveBeenCalledWith('tok', 'o1');
  });

  it('requestNotifications: отказ → не фиксируется, возвращает false', async () => {
    requestMessagesAccess.mockResolvedValue(false);
    expect(await useStore.getState().requestNotifications()).toBe(false);
    expect(enableTelegramNotifications).not.toHaveBeenCalled();
  });

  it('requestNotifications: сбой запроса → false, без исключения', async () => {
    requestMessagesAccess.mockRejectedValue(new Error('no sdk'));
    expect(await useStore.getState().requestNotifications()).toBe(false);
    expect(enableTelegramNotifications).not.toHaveBeenCalled();
  });

  it('resetCheckout очищает результат последнего заказа', async () => {
    invokeCheckout.mockResolvedValue({
      orderId: 'o1',
      orderNumber: 'SH-1',
      totalMinor: 1000,
      currencyCode: 'USD',
    });
    await useStore.getState().placeOrder(RECIPIENT);
    expect(useStore.getState().lastOrder).not.toBeNull();

    useStore.getState().resetCheckout();
    expect(useStore.getState().lastOrder).toBeNull();
    expect(useStore.getState().lastOrderId).toBeNull();
  });
});

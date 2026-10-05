// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { RecipientInfo } from '../../domain/models/customer';

const h = vi.hoisted(() => {
  const state = {
    defaultRecipient: { name: '', phone: '', address: '' } as RecipientInfo,
    serverUser: null as null | { firstName: string; photoUrl: string },
    lastOrder: null as unknown,
    userSettings: { language: 'ru', notifications: false, notificationsPrompted: false },
    placeOrder: vi.fn(),
    requestNotifications: vi.fn(),
    setDefaultRecipient: vi.fn(),
    setUserSettings: vi.fn(),
    resetCheckout: vi.fn(),
  };
  return { state };
});

vi.mock('../store', () => ({
  useStore: Object.assign((selector: (s: typeof h.state) => unknown) => selector(h.state), {
    getState: () => h.state,
  }),
}));

const query = vi.hoisted(() => ({ invalidateQueries: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: query.invalidateQueries }),
}));

import { useCheckout } from './useCheckout';

const VALID: RecipientInfo = {
  name: 'Иван Петров',
  phone: '+79001234567',
  address: 'Москва, ул. Ленина 1',
};

beforeEach(() => {
  h.state.defaultRecipient = { name: '', phone: '', address: '' };
  h.state.serverUser = null;
  h.state.lastOrder = null;
  h.state.userSettings = { language: 'ru', notifications: false, notificationsPrompted: false };
  h.state.placeOrder.mockReset();
  h.state.requestNotifications.mockReset();
  h.state.setDefaultRecipient.mockReset();
  h.state.setUserSettings.mockReset();
  h.state.resetCheckout.mockReset();
  query.invalidateQueries.mockReset();
});

describe('useCheckout', () => {
  it('prefill: сохранённый получатель, иначе имя из Telegram', () => {
    h.state.serverUser = { firstName: 'Иван', photoUrl: '' };
    const { result } = renderHook(() => useCheckout());
    expect(result.current.recipient.name).toBe('Иван');

    h.state.defaultRecipient = { name: 'Пётр', phone: '+7900', address: 'Минск' };
    const second = renderHook(() => useCheckout());
    expect(second.result.current.recipient).toEqual({
      name: 'Пётр',
      phone: '+7900',
      address: 'Минск',
    });
  });

  it('setField санитизирует телефон и обновляет поля', () => {
    const { result } = renderHook(() => useCheckout());
    act(() => result.current.setField({ phone: '+7 (900) 123-45-67' }));
    expect(result.current.recipient.phone).toBe('+79001234567');
    act(() => result.current.setField({ name: 'Анна', address: 'Тверь' }));
    expect(result.current.recipient).toMatchObject({ name: 'Анна', address: 'Тверь' });
  });

  it('валидация: кнопка активна только при всех полях', () => {
    const { result } = renderHook(() => useCheckout());
    expect(result.current.validation.valid).toBe(false);
    act(() => result.current.setField(VALID));
    expect(result.current.validation).toEqual({
      nameValid: true,
      phoneValid: true,
      addressValid: true,
      valid: true,
    });
  });

  it('submit с пустыми полями → ошибка, заказ не отправляется', async () => {
    const { result } = renderHook(() => useCheckout());
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Заполните все поля');
    expect(h.state.placeOrder).not.toHaveBeenCalled();
    expect(h.state.requestNotifications).not.toHaveBeenCalled();
  });

  it('успешный заказ: placeOrder → success, согласие НЕ спрашиваем во время submit', async () => {
    h.state.placeOrder.mockResolvedValue('order-1');
    h.state.lastOrder = {
      orderId: 'order-1',
      orderNumber: 'SH-1',
      totalMinor: 1000,
      currencyCode: 'USD',
    };

    const { result } = renderHook(() => useCheckout());
    act(() => result.current.setField(VALID));

    await act(async () => {
      await result.current.submit();
    });

    expect(h.state.requestNotifications).not.toHaveBeenCalled();
    expect(h.state.placeOrder).toHaveBeenCalledWith(VALID, expect.any(String));
    expect(h.state.setDefaultRecipient).toHaveBeenCalledWith(VALID);
    expect(result.current.status).toBe('success');
    expect(result.current.error).toBeNull();
    expect(result.current.notificationsGranted).toBe(false);
    expect(result.current.lastOrder?.orderNumber).toBe('SH-1');
  });

  it('enableNotifications: согласие → granted + фиксация + orderId для досыла', async () => {
    h.state.requestNotifications.mockResolvedValue(true);
    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.enableNotifications('order-1');
    });

    expect(h.state.requestNotifications).toHaveBeenCalledWith('order-1');
    expect(result.current.notificationsGranted).toBe(true);
    expect(result.current.notificationsPending).toBe(false);
    expect(h.state.setUserSettings).toHaveBeenCalledWith({
      notifications: true,
      notificationsPrompted: true,
    });
  });

  it('enableNotifications: отказ → не granted, без записи настроек', async () => {
    h.state.requestNotifications.mockResolvedValue(false);
    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.enableNotifications();
    });

    expect(result.current.notificationsGranted).toBe(false);
    expect(h.state.setUserSettings).not.toHaveBeenCalled();
  });

  it('enableNotifications: сбой запроса не бросает и не включает granted', async () => {
    h.state.requestNotifications.mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useCheckout());

    await act(async () => {
      await result.current.enableNotifications('order-2');
    });

    expect(result.current.notificationsGranted).toBe(false);
    expect(result.current.notificationsPending).toBe(false);
  });

  it('ошибка checkout → локализованное сообщение (код маппится)', async () => {
    h.state.placeOrder.mockRejectedValue(new Error('INSUFFICIENT_STOCK'));

    const { result } = renderHook(() => useCheckout());
    act(() => result.current.setField(VALID));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Недостаточно товара. Проверьте количество.');
    expect(result.current.notificationsGranted).toBe(false);
  });

  it('reset сбрасывает форму/статус и чистит результат заказа', async () => {
    h.state.placeOrder.mockResolvedValue('order-3');

    const { result } = renderHook(() => useCheckout());
    act(() => result.current.setField(VALID));
    await act(async () => {
      await result.current.submit();
    });
    await waitFor(() => expect(result.current.status).toBe('success'));

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.notificationsGranted).toBe(false);
    expect(h.state.resetCheckout).toHaveBeenCalledTimes(1);
  });

  it('повтор после ошибки переиспользует тот же idempotencyKey (docs/21 P0-01)', async () => {
    h.state.placeOrder
      .mockRejectedValueOnce(new Error('NETWORK'))
      .mockResolvedValueOnce('order-1');

    const { result } = renderHook(() => useCheckout());
    act(() => result.current.setField(VALID));

    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.status).toBe('error');

    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.status).toBe('success');

    expect(h.state.placeOrder).toHaveBeenCalledTimes(2);
    const firstKey = h.state.placeOrder.mock.calls[0][1];
    const secondKey = h.state.placeOrder.mock.calls[1][1];
    expect(typeof firstKey).toBe('string');
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });

  it('после успеха и reset новый attempt получает новый idempotencyKey', async () => {
    h.state.placeOrder.mockResolvedValue('order-1');

    const { result } = renderHook(() => useCheckout());
    act(() => result.current.setField(VALID));
    await act(async () => {
      await result.current.submit();
    });
    const firstKey = h.state.placeOrder.mock.calls[0][1];

    act(() => result.current.reset());
    act(() => result.current.setField(VALID));
    await act(async () => {
      await result.current.submit();
    });
    const secondKey = h.state.placeOrder.mock.calls[1][1];

    expect(typeof secondKey).toBe('string');
    expect(secondKey).not.toBe(firstKey);
  });

  it('конфликт стока → invalidate buyer-cart (docs/21 §3.6)', async () => {
    h.state.placeOrder.mockRejectedValue(new Error('INSUFFICIENT_STOCK'));

    const { result } = renderHook(() => useCheckout());
    act(() => result.current.setField(VALID));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Недостаточно товара. Проверьте количество.');
    expect(query.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['buyer-cart'] });
  });

  it('неконфликтная ошибка → без invalidate корзины', async () => {
    h.state.placeOrder.mockRejectedValue(new Error('UNKNOWN_FAILURE'));

    const { result } = renderHook(() => useCheckout());
    act(() => result.current.setField(VALID));
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toBe('error');
    expect(query.invalidateQueries).not.toHaveBeenCalled();
  });
});

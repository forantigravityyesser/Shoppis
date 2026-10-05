import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeFunction } = vi.hoisted(() => ({ invokeFunction: vi.fn() }));
vi.mock('../insforge/functions-gateway', () => ({ invokeFunction }));

import { enableTelegramNotifications } from './notification-api';

beforeEach(() => invokeFunction.mockReset());

describe('notification-api', () => {
  it('вызывает notifications-actions с action enable', async () => {
    invokeFunction.mockResolvedValue({ data: { success: true }, error: null });

    await enableTelegramNotifications('tok');

    expect(invokeFunction).toHaveBeenCalledWith('notifications-actions', {
      body: { action: 'enable' },
      token: 'tok',
    });
  });

  it('передаёт orderId для досыла «Заказ принят»', async () => {
    invokeFunction.mockResolvedValue({ data: { success: true }, error: null });

    await enableTelegramNotifications('tok', 'o1');

    expect(invokeFunction).toHaveBeenCalledWith('notifications-actions', {
      body: { action: 'enable', orderId: 'o1' },
      token: 'tok',
    });
  });

  it('бросает серверную ошибку', async () => {
    invokeFunction.mockResolvedValue({
      data: { success: false, error: 'Unauthorized' },
      error: null,
    });
    await expect(enableTelegramNotifications('tok')).rejects.toThrow('Unauthorized');
  });

  it('бросает ошибку транспорта', async () => {
    invokeFunction.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    await expect(enableTelegramNotifications('tok')).rejects.toThrow('Network error');
  });
});

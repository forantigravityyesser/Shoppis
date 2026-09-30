import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeFunction, updateStoreProfileDev, updateStoreStatusDev } = vi.hoisted(() => ({
  invokeFunction: vi.fn(),
  updateStoreProfileDev: vi.fn(),
  updateStoreStatusDev: vi.fn(),
}));

vi.mock('../insforge/functions-gateway', () => ({ invokeFunction }));
vi.mock('../insforge/config', () => ({
  DEV_AUTH_MODE: false,
  INSFORGE_URL: 'https://example.test',
  INSFORGE_ANON_KEY: 'anon',
  MEDIA_BUCKET: 'shoppis-media',
}));
vi.mock('./store-settings-api.dev', () => ({ updateStoreProfileDev, updateStoreStatusDev }));

import { updateProfile, updateStatus } from './store-settings-api';
import type { StoreRow } from '../repositories/store-repository';

const ROW: StoreRow = {
  id: 's1',
  owner_user_id: 'u1',
  owner_telegram_id: 'tg1',
  name: 'Nike Shop',
  description: '',
  logo_url: '',
  banner_url: '',
  support_handle: '',
  currency: 'USD',
  currency_symbol: '$',
  language: 'ru',
  status: 'ACTIVE',
  public_id: 'pub1',
  created_at: '2026-09-30T00:00:00.000Z',
};

function ok(row: StoreRow = ROW) {
  return { data: { success: true, store: row }, error: null };
}

beforeEach(() => {
  invokeFunction.mockReset();
  updateStoreProfileDev.mockReset();
  updateStoreStatusDev.mockReset();
});

describe('store-settings-api.updateStoreProfile', () => {
  it('маппит camelCase → snake_case и вызывает store-actions', async () => {
    invokeFunction.mockResolvedValue(ok());

    await updateProfile('tok', 's1', { name: 'New', bannerUrl: 'b.png' });

    expect(invokeFunction).toHaveBeenCalledWith('store-actions', {
      token: 'tok',
      body: {
        action: 'update-profile',
        storeId: 's1',
        patch: { name: 'New', banner_url: 'b.png' },
      },
    });
  });

  it('отправляет только переданные поля (partial)', async () => {
    invokeFunction.mockResolvedValue(ok());

    await updateProfile('tok', 's1', { currency: 'RUB' });

    const [, opts] = invokeFunction.mock.calls[0] as [string, { body: { patch: object } }];
    expect(opts.body.patch).toEqual({ currency: 'RUB' });
    expect(opts.body.patch).not.toHaveProperty('name');
    expect(opts.body.patch).not.toHaveProperty('language');
    expect(opts.body.patch).not.toHaveProperty('support_handle');
  });

  it('возвращает Store, собранный из ответа сервера', async () => {
    invokeFunction.mockResolvedValue(ok());

    const store = await updateProfile('tok', 's1', { language: 'en' });

    expect(store).toMatchObject({ id: 's1', name: 'Nike Shop', currencyCode: 'USD' });
  });

  it('бросает код серверной ошибки', async () => {
    invokeFunction.mockResolvedValue({
      data: { success: false, error: 'FORBIDDEN' },
      error: null,
    });
    await expect(updateProfile('tok', 's1', { name: 'X' })).rejects.toThrow('FORBIDDEN');
  });

  it('бросает ошибку транспорта', async () => {
    invokeFunction.mockResolvedValue({ data: null, error: { message: 'Unauthorized' } });
    await expect(updateProfile('tok', 's1', { name: 'X' })).rejects.toThrow('Unauthorized');
  });

  it('бросает, если ответ без store', async () => {
    invokeFunction.mockResolvedValue({ data: { success: true }, error: null });
    await expect(updateProfile('tok', 's1', { name: 'X' })).rejects.toThrow(
      'Store update failed',
    );
  });

  it('без токена и без DEV_AUTH_MODE не ходит на сервер', async () => {
    await expect(updateProfile(null, 's1', { name: 'X' })).rejects.toThrow('Unauthorized');
    expect(invokeFunction).not.toHaveBeenCalled();
    expect(updateStoreProfileDev).not.toHaveBeenCalled();
  });
});

describe('store-settings-api.updateStatus', () => {
  it('вызывает store-actions с action update-status и возвращает Store', async () => {
    invokeFunction.mockResolvedValue(ok({ ...ROW, status: 'PAUSED' }));

    const store = await updateStatus('tok', 's1', 'PAUSED');

    expect(invokeFunction).toHaveBeenCalledWith('store-actions', {
      token: 'tok',
      body: { action: 'update-status', storeId: 's1', status: 'PAUSED' },
    });
    expect(store.status).toBe('PAUSED');
  });

  it('бросает код серверной ошибки', async () => {
    invokeFunction.mockResolvedValue({
      data: { success: false, error: 'INVALID_STATUS' },
      error: null,
    });
    await expect(updateStatus('tok', 's1', 'PAUSED')).rejects.toThrow('INVALID_STATUS');
  });
});

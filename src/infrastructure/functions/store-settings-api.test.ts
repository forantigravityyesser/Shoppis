import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  invokeFunction,
  readStoreDev,
  updateStoreProfileDev,
  updateStoreStatusDev,
  updateStoreTutorialStateDev,
} = vi.hoisted(() => ({
  invokeFunction: vi.fn(),
  readStoreDev: vi.fn(),
  updateStoreProfileDev: vi.fn(),
  updateStoreStatusDev: vi.fn(),
  updateStoreTutorialStateDev: vi.fn(),
}));

vi.mock('../insforge/functions-gateway', () => ({ invokeFunction }));
vi.mock('../insforge/config', () => ({
  DEV_AUTH_MODE: false,
  INSFORGE_URL: 'https://example.test',
  INSFORGE_ANON_KEY: 'anon',
  MEDIA_BUCKET: 'shoppis-media',
}));
vi.mock('./store-settings-api.dev', () => ({
  readStoreDev,
  updateStoreProfileDev,
  updateStoreStatusDev,
  updateStoreTutorialStateDev,
}));

import { readStore, updateProfile, updateStatus, updateTutorialState } from './store-settings-api';
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
  readStoreDev.mockReset();
  updateStoreProfileDev.mockReset();
  updateStoreStatusDev.mockReset();
  updateStoreTutorialStateDev.mockReset();
});

describe('store-settings-api.readStore (R1)', () => {
  it('с сессией читает owner-scoped через store-actions action read', async () => {
    invokeFunction.mockResolvedValue(ok());

    const store = await readStore('tok', 'pub1');

    expect(invokeFunction).toHaveBeenCalledWith('store-actions', {
      token: 'tok',
      body: { action: 'read', storeRef: 'pub1' },
    });
    expect(store).toMatchObject({ id: 's1', publicId: 'pub1' });
  });

  it('чужой/несуществующий магазин → null, не ошибка', async () => {
    invokeFunction.mockResolvedValue({ data: { success: true, store: null }, error: null });

    await expect(readStore('tok', 'other')).resolves.toBeNull();
  });

  it('бросает код серверной ошибки', async () => {
    invokeFunction.mockResolvedValue({ data: { success: false, error: 'FORBIDDEN' }, error: null });
    await expect(readStore('tok', 'pub1')).rejects.toThrow('FORBIDDEN');
  });

  it('бросает ошибку транспорта', async () => {
    invokeFunction.mockResolvedValue({ data: null, error: { message: 'Unauthorized' } });
    await expect(readStore('tok', 'pub1')).rejects.toThrow('Unauthorized');
  });

  it('без токена и без DEV_AUTH_MODE не ходит на сервер', async () => {
    await expect(readStore(null, 'pub1')).rejects.toThrow('Unauthorized');
    expect(invokeFunction).not.toHaveBeenCalled();
    expect(readStoreDev).not.toHaveBeenCalled();
  });
});

describe('store-settings-api.updateStoreProfile', () => {
  it('маппит camelCase → snake_case и вызывает store-actions', async () => {
    invokeFunction.mockResolvedValue(ok());

    await updateProfile('tok', 's1', { name: 'New', bannerUrl: 'b.png', description: 'О нас' });

    expect(invokeFunction).toHaveBeenCalledWith('store-actions', {
      token: 'tok',
      body: {
        action: 'update-profile',
        storeId: 's1',
        patch: { name: 'New', banner_url: 'b.png', description: 'О нас' },
      },
    });
  });

  it('отправляет только переданные поля (partial)', async () => {
    invokeFunction.mockResolvedValue(ok());

    await updateProfile('tok', 's1', { currency: 'RUB' });

    const [, opts] = invokeFunction.mock.calls[0] as [string, { body: { patch: object } }];
    expect(opts.body.patch).toEqual({ currency: 'RUB' });
    expect(opts.body.patch).not.toHaveProperty('name');
    expect(opts.body.patch).not.toHaveProperty('description');
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
    await expect(updateProfile('tok', 's1', { name: 'X' })).rejects.toThrow('Store update failed');
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

describe('store-settings-api.updateTutorialState', () => {
  it('маппит состояния в snake_case и вызывает store-actions action tutorial-state', async () => {
    invokeFunction.mockResolvedValue(
      ok({
        ...ROW,
        tutorial_status: 'in_progress',
        tutorial_step: 'orientation',
        tutorial_welcome_decision: 'accepted',
      }),
    );

    await updateTutorialState('tok', 's1', {
      welcomeDecision: 'accepted',
      status: 'in_progress',
      step: 'orientation',
    });

    expect(invokeFunction).toHaveBeenCalledWith('store-actions', {
      token: 'tok',
      body: {
        action: 'tutorial-state',
        storeId: 's1',
        patch: { welcome_decision: 'accepted', status: 'in_progress', step: 'orientation' },
      },
    });
  });

  it('отправляет step=null для завершённого обучения', async () => {
    invokeFunction.mockResolvedValue(
      ok({ ...ROW, tutorial_welcome_decision: 'accepted', tutorial_status: 'completed' }),
    );

    await updateTutorialState('tok', 's1', {
      welcomeDecision: 'accepted',
      status: 'completed',
      step: null,
    });

    const [, opts] = invokeFunction.mock.calls[0] as [string, { body: { patch: object } }];
    expect(opts.body.patch).toEqual({
      welcome_decision: 'accepted',
      status: 'completed',
      step: null,
    });
  });

  it('возвращает Store с tutorial-полями из ответа', async () => {
    invokeFunction.mockResolvedValue(
      ok({
        ...ROW,
        tutorial_welcome_decision: 'accepted',
        tutorial_status: 'in_progress',
        tutorial_step: 'storefront',
      }),
    );

    const store = await updateTutorialState('tok', 's1', {
      welcomeDecision: 'accepted',
      status: 'in_progress',
      step: 'storefront',
    });

    expect(store).toMatchObject({
      id: 's1',
      tutorialWelcomeDecision: 'accepted',
      tutorialStatus: 'in_progress',
      tutorialStep: 'storefront',
    });
  });

  it('бросает код серверной ошибки INVALID_TUTORIAL_STATE', async () => {
    invokeFunction.mockResolvedValue({
      data: { success: false, error: 'INVALID_TUTORIAL_STATE' },
      error: null,
    });
    await expect(
      updateTutorialState('tok', 's1', {
        welcomeDecision: 'accepted',
        status: 'in_progress',
        step: null,
      }),
    ).rejects.toThrow('INVALID_TUTORIAL_STATE');
  });

  it('без токена и без DEV_AUTH_MODE не ходит на сервер', async () => {
    await expect(
      updateTutorialState(null, 's1', {
        welcomeDecision: 'accepted',
        status: 'in_progress',
        step: 'orientation',
      }),
    ).rejects.toThrow('Unauthorized');
    expect(invokeFunction).not.toHaveBeenCalled();
    expect(updateStoreTutorialStateDev).not.toHaveBeenCalled();
  });
});

describe('store-settings-api — ловушка проекции (docs/26 §3.6)', () => {
  it('updateProfile сохраняет tutorial-поля из проекции RPC', async () => {
    invokeFunction.mockResolvedValue(
      ok({
        ...ROW,
        tutorial_welcome_decision: 'accepted',
        tutorial_status: 'in_progress',
        tutorial_step: 'product-create',
      }),
    );

    const store = await updateProfile('tok', 's1', { name: 'New' });

    expect(store.tutorialWelcomeDecision).toBe('accepted');
    expect(store.tutorialStatus).toBe('in_progress');
    expect(store.tutorialStep).toBe('product-create');
  });
});

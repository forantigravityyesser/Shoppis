// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeRepository = {
  fetchStore: vi.fn(),
  fetchStoresByOwnerUser: vi.fn(),
  fetchStoresByOwnerTelegram: vi.fn(),
};

const storeSettingsApi = {
  readStore: vi.fn(),
  updateProfile: vi.fn(),
  updateStatus: vi.fn(),
  updateTutorialState: vi.fn(),
};

const authApi = {
  setAccessToken: vi.fn(),
};

vi.mock('../../composition/container', () => ({
  deps: () => ({
    i18n: {
      getAppLanguage: () => 'ru',
      setAppLanguage: () => {},
      applyStoreDefaultLanguage: () => {},
    },
    storeRepository,
    storeSettingsApi,
    authApi,
  }),
}));

import { useStore } from '../index';
import { queryClient } from '../../queryClient';
import { orderKeys } from '../../orders/order-cache';
import type { ServerUser } from '../../contracts/auth';
import type { Store } from '../../../domain/models/store';

function user(id: string): ServerUser {
  return {
    id,
    telegramUserId: id,
    username: '',
    firstName: '',
    languageCode: 'ru',
    photoUrl: '',
    notificationsEnabled: false,
  };
}

const LIST_KEY = orderKeys.list('u1', 'buyer', 'store-a', 'all');
const DETAIL_KEY = orderKeys.detail('u1', 'buyer', 'o1');
const PAGE = { pages: [{ orders: [], nextCursor: null }], pageParams: [null] };

beforeEach(() => {
  useStore.setState({ sessionToken: null, serverUser: null });
  queryClient.clear();
  storeRepository.fetchStore.mockReset();
  storeRepository.fetchStoresByOwnerUser.mockReset();
  storeRepository.fetchStoresByOwnerTelegram.mockReset();
  storeSettingsApi.readStore.mockReset();
  storeSettingsApi.updateProfile.mockReset();
  storeSettingsApi.updateStatus.mockReset();
  storeSettingsApi.updateTutorialState.mockReset();
  authApi.setAccessToken.mockReset();
});

describe('orders-кэш ↔ личность (docs/24 §3.4, ORD-HARDEN-04)', () => {
  it('clearSession убирает list+detail кэш заказов', () => {
    queryClient.setQueryData(LIST_KEY, PAGE);
    queryClient.setQueryData(DETAIL_KEY, { id: 'o1' });
    useStore.setState({ sessionToken: 'tok', serverUser: user('u1') });

    useStore.getState().clearSession();

    expect(useStore.getState().serverUser).toBeNull();
    expect(useStore.getState().sessionToken).toBeNull();
    expect(queryClient.getQueryData(LIST_KEY)).toBeUndefined();
    expect(queryClient.getQueryData(DETAIL_KEY)).toBeUndefined();
  });

  it('смена serverUser убирает кэш прошлого пользователя', () => {
    queryClient.setQueryData(LIST_KEY, PAGE);
    useStore.setState({ sessionToken: 'tok', serverUser: user('u1') });

    useStore.getState().setSession('tok2', user('u2'), null);

    expect(queryClient.getQueryData(LIST_KEY)).toBeUndefined();
  });

  it('тот же пользователь: кэш не трогаем (обновление токена)', () => {
    queryClient.setQueryData(LIST_KEY, PAGE);
    useStore.setState({ sessionToken: 'tok', serverUser: user('u1') });

    useStore.getState().setSession('tok2', user('u1'), null);

    expect(queryClient.getQueryData(LIST_KEY)).toBeDefined();
  });
});

function store(id: string): Store {
  return {
    id,
    ownerUserId: 'u1',
    ownerTelegramId: 'u1',
    name: 'Shop',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    supportHandle: '',
    currencyCode: 'USD',
    currencySymbol: '$',
    language: 'ru',
    status: 'ACTIVE',
    publicId: `pub_${id}`,
    createdAt: '',
    tutorialWelcomeDecision: 'unknown',
    tutorialStatus: 'not_started',
    tutorialStep: null,
    tutorialUpdatedAt: null,
  };
}

describe('enterStorePreview / exitStorePreview — предпросмотр из seller', () => {
  it('переводит контекст в buyer и строит viewedStore из currentStore', () => {
    const current = { ...store('s1'), supportHandle: '@shop', logoUrl: 'logo.png' };
    useStore.setState({ context: 'seller', storeId: 's1', currentStore: current });

    useStore.getState().enterStorePreview('pub_s1', '/seller/inventory/product/p1');

    const state = useStore.getState();
    expect(state.context).toBe('buyer');
    expect(state.previewReturnPath).toBe('/seller/inventory/product/p1');
    expect(state.viewedStore).toEqual({
      id: 's1',
      publicId: 'pub_s1',
      name: 'Shop',
      status: 'ACTIVE',
      supportHandle: '@shop',
      logoUrl: 'logo.png',
    });
    expect(state.storeId).toBe('s1');
    expect(state.currentStore).toBe(current);
  });

  it('пустые supportHandle/logoUrl становятся null (публичная проекция)', () => {
    useStore.setState({ context: 'seller', storeId: 's1', currentStore: store('s1') });

    useStore.getState().enterStorePreview('pub_s1', '/seller/inventory/product/p1');

    expect(useStore.getState().viewedStore?.supportHandle).toBeNull();
    expect(useStore.getState().viewedStore?.logoUrl).toBeNull();
  });

  it('чужой publicId — no-op (защита от неверного входа)', () => {
    useStore.setState({
      context: 'seller',
      storeId: 's1',
      currentStore: store('s1'),
      viewedStore: null,
      previewReturnPath: null,
    });

    useStore.getState().enterStorePreview('other', '/seller/inventory/product/p1');

    expect(useStore.getState().context).toBe('seller');
    expect(useStore.getState().viewedStore).toBeNull();
    expect(useStore.getState().previewReturnPath).toBeNull();
  });

  it('exitStorePreview возвращает seller и чистит предпросмотр', () => {
    useStore.setState({ context: 'seller', storeId: 's1', currentStore: store('s1') });
    useStore.getState().enterStorePreview('pub_s1', '/seller/inventory/product/p1');

    useStore.getState().exitStorePreview();

    const state = useStore.getState();
    expect(state.context).toBe('seller');
    expect(state.viewedStore).toBeNull();
    expect(state.previewReturnPath).toBeNull();
    expect(state.storeId).toBe('s1');
  });
});

describe('loadSellerStore — scope магазина при старте (01 §5)', () => {
  it('у магазина владельца нет → storeId сбрасывается (иначе роутер минует онбординг)', async () => {
    useStore.setState({
      context: 'seller',
      sessionToken: 'tok',
      serverUser: user('u1'),
      storeId: 'stale-deleted-store',
    });
    storeRepository.fetchStoresByOwnerUser.mockResolvedValue([]);

    await expect(useStore.getState().loadSellerStore()).resolves.toBeNull();
    expect(useStore.getState().storeId).toBeNull();
  });

  it('магазин найден → storeId и currentStore установлены', async () => {
    useStore.setState({ context: 'seller', sessionToken: 'tok', serverUser: user('u1') });
    storeRepository.fetchStoresByOwnerUser.mockResolvedValue([store('s1')]);

    await expect(useStore.getState().loadSellerStore()).resolves.toBe('s1');
    expect(useStore.getState().storeId).toBe('s1');
    expect(useStore.getState().currentStore?.id).toBe('s1');
  });
});

describe('tutorial state (docs/26 §3.2/§3.6, TUT-02)', () => {
  it('updateTutorialState пишет состояние и кладёт ответ сервера в currentStore', async () => {
    useStore.setState({ storeId: 's1', sessionToken: 'tok', currentStore: store('s1') });
    storeSettingsApi.updateTutorialState.mockResolvedValue({
      ...store('s1'),
      tutorialWelcomeDecision: 'accepted',
      tutorialStatus: 'in_progress',
      tutorialStep: 'orientation',
    });

    await useStore.getState().updateTutorialState({
      welcomeDecision: 'accepted',
      status: 'in_progress',
      step: 'orientation',
    });

    expect(storeSettingsApi.updateTutorialState).toHaveBeenCalledWith('tok', 's1', {
      welcomeDecision: 'accepted',
      status: 'in_progress',
      step: 'orientation',
    });
    expect(useStore.getState().currentStore?.tutorialStatus).toBe('in_progress');
    expect(useStore.getState().currentStore?.tutorialStep).toBe('orientation');
  });

  it('updateStoreProfile не теряет tutorial-поля (проекция RPC их включает)', async () => {
    useStore.setState({ storeId: 's1', sessionToken: 'tok', currentStore: store('s1') });
    storeSettingsApi.updateProfile.mockResolvedValue({
      ...store('s1'),
      name: 'New',
      tutorialWelcomeDecision: 'accepted',
      tutorialStatus: 'in_progress',
      tutorialStep: 'storefront',
    });

    await useStore.getState().updateStoreProfile({ name: 'New' });

    const current = useStore.getState().currentStore;
    expect(current?.name).toBe('New');
    expect(current?.tutorialWelcomeDecision).toBe('accepted');
    expect(current?.tutorialStatus).toBe('in_progress');
    expect(current?.tutorialStep).toBe('storefront');
  });

  it('updateTutorialState без выбранного магазина → ошибка', async () => {
    useStore.setState({ storeId: null, currentStore: null });
    await expect(
      useStore
        .getState()
        .updateTutorialState({
          welcomeDecision: 'accepted',
          status: 'in_progress',
          step: 'orientation',
        }),
    ).rejects.toThrow('Store is not selected');
    expect(storeSettingsApi.updateTutorialState).not.toHaveBeenCalled();
  });
});

describe('fetchCurrentStore — owner-scoped read (R1/A1)', () => {
  it('с сессией читает через серверный readStore по каноническому public_id', async () => {
    useStore.setState({ storeId: 's1', sessionToken: 'tok', currentStore: store('s1') });
    storeSettingsApi.readStore.mockResolvedValue(store('s1'));

    await useStore.getState().fetchCurrentStore();

    expect(storeSettingsApi.readStore).toHaveBeenCalledWith('tok', 'pub_s1');
    expect(storeRepository.fetchStore).not.toHaveBeenCalled();
    expect(useStore.getState().currentStore?.id).toBe('s1');
  });

  it('без сессии — readStore сам решает DEV-fallback (нет прямого fetchStore)', async () => {
    useStore.setState({ storeId: 's1', sessionToken: null, currentStore: store('s1') });
    storeSettingsApi.readStore.mockResolvedValue(store('s1'));

    await useStore.getState().fetchCurrentStore();

    expect(storeSettingsApi.readStore).toHaveBeenCalledWith(null, 'pub_s1');
    expect(storeRepository.fetchStore).not.toHaveBeenCalled();
    expect(useStore.getState().currentStore?.id).toBe('s1');
  });

  it('null (чужой/удалён) → сброс scope, не ошибка', async () => {
    useStore.setState({ storeId: 's1', sessionToken: 'tok', currentStore: store('s1') });
    storeSettingsApi.readStore.mockResolvedValue(null);

    await useStore.getState().fetchCurrentStore();

    expect(storeSettingsApi.readStore).toHaveBeenCalledWith('tok', 'pub_s1');
    expect(useStore.getState().storeId).toBeNull();
    expect(useStore.getState().currentStore).toBeNull();
    expect(useStore.getState().authLoading).toBe(false);
  });

  it('ошибка чтения → authError и проброс', async () => {
    useStore.setState({ storeId: 's1', sessionToken: 'tok', currentStore: store('s1') });
    storeSettingsApi.readStore.mockRejectedValue(new Error('network'));

    await expect(useStore.getState().fetchCurrentStore()).rejects.toThrow('network');
    expect(useStore.getState().authError).toBe('network');
    expect(useStore.getState().authLoading).toBe(false);
  });

  it('storeId без currentStore (нет канонического ref) → запрос не уходит', async () => {
    useStore.setState({ storeId: 's1', sessionToken: 'tok', currentStore: null });

    await useStore.getState().fetchCurrentStore();

    expect(storeSettingsApi.readStore).not.toHaveBeenCalled();
    expect(storeRepository.fetchStore).not.toHaveBeenCalled();
    expect(useStore.getState().storeId).toBeNull();
    expect(useStore.getState().currentStore).toBeNull();
  });
});

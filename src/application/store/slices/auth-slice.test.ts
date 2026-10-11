// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../composition/container', () => ({
  deps: () => ({
    i18n: { getAppLanguage: () => 'ru', setAppLanguage: () => {} },
  }),
}));

import { useStore } from '../index';
import { queryClient } from '../../queryClient';
import { orderKeys } from '../../orders/order-cache';
import type { ServerUser } from '../../contracts/auth';

function user(id: string): ServerUser {
  return {
    id,
    telegramUserId: id,
    username: '',
    firstName: '',
    languageCode: 'ru',
    photoUrl: '',
  };
}

const LIST_KEY = orderKeys.list('u1', 'buyer', 'store-a', 'all');
const DETAIL_KEY = orderKeys.detail('u1', 'buyer', 'o1');
const PAGE = { pages: [{ orders: [], nextCursor: null }], pageParams: [null] };

beforeEach(() => {
  useStore.setState({ sessionToken: null, serverUser: null });
  queryClient.clear();
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

    useStore.getState().setSession('tok2', user('u2'));

    expect(queryClient.getQueryData(LIST_KEY)).toBeUndefined();
  });

  it('тот же пользователь: кэш не трогаем (обновление токена)', () => {
    queryClient.setQueryData(LIST_KEY, PAGE);
    useStore.setState({ sessionToken: 'tok', serverUser: user('u1') });

    useStore.getState().setSession('tok2', user('u1'));

    expect(queryClient.getQueryData(LIST_KEY)).toBeDefined();
  });
});

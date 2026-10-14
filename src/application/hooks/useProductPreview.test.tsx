// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const navigate = vi.hoisted(() => vi.fn());
const enterStorePreview = vi.hoisted(() => vi.fn());

const h = vi.hoisted(() => ({
  state: {
    currentStore: null as null | { publicId: string },
    enterStorePreview,
  },
}));

vi.mock('react-router', () => ({ useNavigate: () => navigate }));

vi.mock('../store', () => ({
  useStore: { getState: () => h.state },
}));

import { useProductPreview } from './useProductPreview';

beforeEach(() => {
  navigate.mockReset();
  enterStorePreview.mockReset();
  h.state.currentStore = { publicId: 'pub_s1' };
  h.state.enterStorePreview = enterStorePreview;
});

describe('useProductPreview', () => {
  it('входит в предпросмотр и открывает публичную карточку товара', () => {
    const { result } = renderHook(() => useProductPreview());

    act(() => {
      result.current.openProductPreview('p1', '/seller/inventory/product/p1');
    });

    expect(enterStorePreview).toHaveBeenCalledWith('pub_s1', '/seller/inventory/product/p1');
    expect(navigate).toHaveBeenCalledWith('/product/p1');
  });

  it('без витрины (нет publicId) ничего не делает', () => {
    h.state.currentStore = null;
    const { result } = renderHook(() => useProductPreview());

    act(() => {
      result.current.openProductPreview('p1', '/seller/inventory/product/p1');
    });

    expect(enterStorePreview).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

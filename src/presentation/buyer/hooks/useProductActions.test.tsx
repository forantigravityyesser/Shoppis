// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { StorefrontProductDetail } from '../../../application/read-models/storefront-product';

const { ensureShareImage, prepareShare, sharePreparedMessage, openTelegramLink, sessionRef } =
  vi.hoisted(() => ({
    ensureShareImage: vi.fn(),
    prepareShare: vi.fn(),
    sharePreparedMessage: vi.fn(),
    openTelegramLink: vi.fn(),
    sessionRef: { current: 'tok' as string | null },
  }));

vi.mock('../../../application/composition/container', () => ({
  deps: () => ({
    storage: { ensureShareImage },
    shareApi: { prepareShare },
    telegram: { sharePreparedMessage },
  }),
}));

vi.mock('../../../application/store', () => ({
  useStore: (selector: (state: { showToast: () => void; sessionToken: string | null }) => unknown) =>
    selector({ showToast: vi.fn(), sessionToken: sessionRef.current }),
}));

vi.mock('../../../application/hooks/useStorefrontLink', () => ({
  useStorefrontProductLink: () => 'https://t.me/bot/shop?startapp=prod_pub_p1',
}));

vi.mock('../../../application/hooks/useOpenTelegramLink', () => ({
  useOpenTelegramLink: () => openTelegramLink,
}));

vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn(), notifySuccess: vi.fn() }),
}));

vi.mock('../../../application/hooks/useFavorites', () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}));

vi.mock('../../../application/hooks/useCart', () => ({
  useCart: () => ({ addToCart: vi.fn() }),
}));

import { useProductActions } from './useProductActions';

const detail = {
  store: { publicId: 'pub' },
  product: { id: 'p1', title: 'Кроссовки' },
  images: [{ url: 'https://cdn/full.webp', thumbUrl: null, sortOrder: 0 }],
} as unknown as StorefrontProductDetail;

const FALLBACK = `https://t.me/share/url?url=${encodeURIComponent(
  'https://t.me/bot/shop?startapp=prod_pub_p1',
)}&text=${encodeURIComponent('Кроссовки')}`;

beforeEach(() => {
  ensureShareImage.mockReset().mockResolvedValue('https://cdn/share.jpg');
  prepareShare.mockReset().mockResolvedValue('mid-1');
  sharePreparedMessage.mockReset().mockReturnValue(true);
  openTelegramLink.mockReset().mockReturnValue(true);
  sessionRef.current = 'tok';
});

describe('useProductActions.share', () => {
  it('готовит карточку и открывает нативный диалог (fallback не используется)', async () => {
    const { result } = renderHook(() => useProductActions(detail, null));

    result.current.share();

    await waitFor(() => expect(sharePreparedMessage).toHaveBeenCalledWith('mid-1'));
    expect(ensureShareImage).toHaveBeenCalledWith('p1', 'https://cdn/full.webp');
    expect(prepareShare).toHaveBeenCalledWith('tok', 'pub', 'p1', 'https://cdn/share.jpg');
    expect(openTelegramLink).not.toHaveBeenCalled();
  });

  it('клиент без Bot API 8.0 → fallback t.me/share/url с ссылкой на товар', async () => {
    sharePreparedMessage.mockReturnValue(false);
    const { result } = renderHook(() => useProductActions(detail, null));

    result.current.share();

    await waitFor(() => expect(openTelegramLink).toHaveBeenCalledWith(FALLBACK));
  });

  it('нет сессии → сразу fallback, без подготовки', async () => {
    sessionRef.current = null;
    const { result } = renderHook(() => useProductActions(detail, null));

    result.current.share();

    await waitFor(() => expect(openTelegramLink).toHaveBeenCalledWith(FALLBACK));
    expect(ensureShareImage).not.toHaveBeenCalled();
    expect(prepareShare).not.toHaveBeenCalled();
  });

  it('не удалось подготовить JPEG → fallback', async () => {
    ensureShareImage.mockResolvedValue(null);
    const { result } = renderHook(() => useProductActions(detail, null));

    result.current.share();

    await waitFor(() => expect(openTelegramLink).toHaveBeenCalledWith(FALLBACK));
    expect(prepareShare).not.toHaveBeenCalled();
  });

  it('ошибка подготовки на сервере → fallback', async () => {
    prepareShare.mockRejectedValue(new Error('SHARE_PREPARE_FAILED'));
    const { result } = renderHook(() => useProductActions(detail, null));

    result.current.share();

    await waitFor(() => expect(openTelegramLink).toHaveBeenCalledWith(FALLBACK));
  });
});

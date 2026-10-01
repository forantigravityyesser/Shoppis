import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sdkOpenTelegramLink } = vi.hoisted(() => ({
  sdkOpenTelegramLink: Object.assign(vi.fn(), { isAvailable: vi.fn() }),
}));

vi.mock('@telegram-apps/sdk', () => ({
  init: vi.fn(),
  initData: {},
  miniApp: {},
  viewport: {},
  openTelegramLink: sdkOpenTelegramLink,
}));

import { openTelegramLink } from './telegram-app';

beforeEach(() => {
  sdkOpenTelegramLink.mockReset();
  sdkOpenTelegramLink.isAvailable.mockReset();
});

describe('openTelegramLink', () => {
  it('использует Telegram SDK, когда доступно', () => {
    sdkOpenTelegramLink.isAvailable.mockReturnValue(true);

    openTelegramLink('https://t.me/BuyShoppis_bot/shop?startapp=shop_abc');

    expect(sdkOpenTelegramLink).toHaveBeenCalledWith(
      'https://t.me/BuyShoppis_bot/shop?startapp=shop_abc',
    );
  });

  it('вне Telegram не бросает и не зовёт SDK', () => {
    sdkOpenTelegramLink.isAvailable.mockReturnValue(false);

    expect(() => openTelegramLink('https://t.me/x')).not.toThrow();
    expect(sdkOpenTelegramLink).not.toHaveBeenCalled();
  });

  it('безопасно деградирует, если SDK бросает', () => {
    sdkOpenTelegramLink.isAvailable.mockReturnValue(true);
    sdkOpenTelegramLink.mockImplementation(() => {
      throw new Error('FunctionNotAvailableError');
    });

    expect(() => openTelegramLink('https://t.me/x')).not.toThrow();
  });
});

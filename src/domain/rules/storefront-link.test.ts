import { describe, expect, it } from 'vitest';
import {
  buildStorefrontLink,
  buildStorefrontStartParam,
  parseLegacyStoreStartParam,
  parseStorefrontStartParam,
} from './storefront-link';

describe('buildStorefrontStartParam', () => {
  it('добавляет префикс shop_', () => {
    expect(buildStorefrontStartParam('abc123')).toBe('shop_abc123');
  });
});

describe('buildStorefrontLink', () => {
  it('Direct Link: bot/app?startapp= (нужно именованное Mini App)', () => {
    expect(
      buildStorefrontLink({ botUsername: 'buyer_bot', appShortname: 'shop', publicId: 'abc' }),
    ).toBe('https://t.me/buyer_bot/shop?startapp=shop_abc');
  });

  it('Main Mini App: bot?startapp= (без именованного app)', () => {
    expect(buildStorefrontLink({ botUsername: 'buyer_bot', publicId: 'abc' })).toBe(
      'https://t.me/buyer_bot?startapp=shop_abc',
    );
  });

  it('нормализует bot username и short name (нижний регистр, без @ и /)', () => {
    expect(
      buildStorefrontLink({
        botUsername: '@BuyShoppis_bot',
        appShortname: '/BuyShoppis',
        publicId: 'abc',
      }),
    ).toBe('https://t.me/BuyShoppis_bot/buyshoppis?startapp=shop_abc');
  });

  it('не содержит внутренних идентификаторов и секретов', () => {
    const url = buildStorefrontLink({
      botUsername: 'BuyShoppis_bot',
      appShortname: 'shop',
      publicId: 'abc123',
    });
    expect(url).not.toMatch(/session|token|secret|owner|\buuid\b/i);
    expect(url).not.toMatch(/store_/);
  });
});

describe('parseStorefrontStartParam', () => {
  it('разбирает shop_<public_id>', () => {
    expect(parseStorefrontStartParam('shop_abc')).toBe('abc');
  });

  it('игнорирует чужие и пустые значения', () => {
    expect(parseStorefrontStartParam('store_abc')).toBeNull();
    expect(parseStorefrontStartParam('seller')).toBeNull();
    expect(parseStorefrontStartParam('shop_')).toBeNull();
    expect(parseStorefrontStartParam('')).toBeNull();
    expect(parseStorefrontStartParam(null)).toBeNull();
    expect(parseStorefrontStartParam(undefined)).toBeNull();
  });
});

describe('parseLegacyStoreStartParam', () => {
  it('читает старые store_<id> ссылки', () => {
    expect(parseLegacyStoreStartParam('store_abc')).toBe('abc');
  });

  it('не трогает канонический shop_ и пустые', () => {
    expect(parseLegacyStoreStartParam('shop_abc')).toBeNull();
    expect(parseLegacyStoreStartParam('store_')).toBeNull();
    expect(parseLegacyStoreStartParam(null)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildProductStartParam,
  buildStorefrontLink,
  buildStorefrontProductLink,
  buildStorefrontStartParam,
  parseLegacyStoreStartParam,
  parseProductStartParam,
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

describe('buildProductStartParam', () => {
  it('собирает prod_<public_id>_<product_id>', () => {
    expect(buildProductStartParam('abc123', 'p-1')).toBe('prod_abc123_p-1');
  });
});

describe('buildStorefrontProductLink', () => {
  it('Direct Link: bot/app?startapp=prod_<public>_<product>', () => {
    expect(
      buildStorefrontProductLink({
        botUsername: 'buyer_bot',
        appShortname: 'shop',
        publicId: 'abc',
        productId: 'p-1',
      }),
    ).toBe('https://t.me/buyer_bot/shop?startapp=prod_abc_p-1');
  });

  it('Main Mini App: bot?startapp= (без именованного app)', () => {
    expect(
      buildStorefrontProductLink({ botUsername: 'buyer_bot', publicId: 'abc', productId: 'p-1' }),
    ).toBe('https://t.me/buyer_bot?startapp=prod_abc_p-1');
  });

  it('нормализует bot username и short name', () => {
    expect(
      buildStorefrontProductLink({
        botUsername: '@BuyShoppis_bot',
        appShortname: '/BuyShoppis',
        publicId: 'abc',
        productId: 'p-1',
      }),
    ).toBe('https://t.me/BuyShoppis_bot/buyshoppis?startapp=prod_abc_p-1');
  });
});

describe('parseProductStartParam', () => {
  it('разбирает prod_<public_id>_<product_id>', () => {
    expect(parseProductStartParam('prod_abc123_0f8f-fa')).toEqual({
      publicId: 'abc123',
      productId: '0f8f-fa',
    });
  });

  it('не трогает магазинные/legacy и битые значения', () => {
    expect(parseProductStartParam('shop_abc')).toBeNull();
    expect(parseProductStartParam('store_abc')).toBeNull();
    expect(parseProductStartParam('seller')).toBeNull();
    expect(parseProductStartParam('prod_')).toBeNull();
    expect(parseProductStartParam('prod_abc')).toBeNull();
    expect(parseProductStartParam('prod_abc_')).toBeNull();
    expect(parseProductStartParam('prod__p1')).toBeNull();
    expect(parseProductStartParam('')).toBeNull();
    expect(parseProductStartParam(null)).toBeNull();
    expect(parseProductStartParam(undefined)).toBeNull();
  });

  it('сохраняет разделители в productId (UUID с дефисами)', () => {
    expect(parseProductStartParam('prod_abc_0f8f8c1e-0000-4000-8000-000000000000')).toEqual({
      publicId: 'abc',
      productId: '0f8f8c1e-0000-4000-8000-000000000000',
    });
  });
});

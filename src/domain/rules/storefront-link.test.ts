import { describe, expect, it } from 'vitest';
import {
  buildStorefrontLink,
  buildStorefrontStartParam,
  parseStorefrontStartParam,
} from './storefront-link';

describe('buildStorefrontStartParam', () => {
  it('добавляет префикс shop_', () => {
    expect(buildStorefrontStartParam('abc123')).toBe('shop_abc123');
  });
});

describe('buildStorefrontLink', () => {
  it('строит прямую ссылку в Mini App с app shortname', () => {
    expect(
      buildStorefrontLink({ botUsername: 'buyer_bot', appShortname: 'shop', publicId: 'abc' }),
    ).toBe('https://t.me/buyer_bot/shop?startapp=shop_abc');
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

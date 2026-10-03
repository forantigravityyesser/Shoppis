import { describe, it, expect } from 'vitest';
import { mapStorefrontHome } from './storefront-mappers';

const baseStore = {
  id: 'store-1',
  publicId: 'pub-1',
  name: 'Nike Shop',
  bannerUrl: 'https://cdn/banner.jpg',
  sellerAvatarUrl: 'https://cdn/avatar.jpg',
  status: 'ACTIVE',
  currencyCode: 'USD',
  currencySymbol: '$',
};

const fullHome = {
  store: baseStore,
  categories: [{ id: 'cat-1', name: 'Обувь', imageUrl: 'https://cdn/cat.jpg', sortOrder: 2 }],
  products: [
    {
      id: 'p-1',
      title: 'Nike T-Shirt',
      categoryId: 'cat-1',
      imageUrl: 'https://cdn/thumb.jpg',
      price: 249000,
      originalPrice: 349000,
      available: true,
    },
  ],
};

describe('mapStorefrontHome', () => {
  it('возвращает null на пустой ответ', () => {
    expect(mapStorefrontHome(null)).toBeNull();
    expect(mapStorefrontHome(undefined)).toBeNull();
    expect(mapStorefrontHome('nope')).toBeNull();
  });

  it('возвращает null, если магазин отсутствует или без id/publicId', () => {
    expect(mapStorefrontHome({ categories: [], products: [] })).toBeNull();
    expect(mapStorefrontHome({ store: { id: 'x' } })).toBeNull();
    expect(mapStorefrontHome({ store: { publicId: 'x' } })).toBeNull();
  });

  it('маппит полный ответ', () => {
    expect(mapStorefrontHome(fullHome)).toEqual({
      store: {
        id: 'store-1',
        publicId: 'pub-1',
        name: 'Nike Shop',
        bannerUrl: 'https://cdn/banner.jpg',
        sellerAvatarUrl: 'https://cdn/avatar.jpg',
        status: 'ACTIVE',
        currencyCode: 'USD',
        currencySymbol: '$',
      },
      categories: [{ id: 'cat-1', name: 'Обувь', imageUrl: 'https://cdn/cat.jpg', sortOrder: 2 }],
      products: [
        {
          id: 'p-1',
          title: 'Nike T-Shirt',
          categoryId: 'cat-1',
          imageUrl: 'https://cdn/thumb.jpg',
          price: 249000,
          originalPrice: 349000,
          available: true,
        },
      ],
    });
  });

  it('пустые/отсутствующие списки → []', () => {
    const home = mapStorefrontHome({ store: baseStore });
    expect(home?.categories).toEqual([]);
    expect(home?.products).toEqual([]);
  });

  it('фильтрует некорректные элементы списков', () => {
    const home = mapStorefrontHome({
      store: baseStore,
      categories: [null, { name: 'Без id' }, { id: 'cat-1', name: 'Обувь' }],
      products: ['bad', { title: 'Без id' }, { id: 'p-1', title: 'OK' }],
    });
    expect(home?.categories).toHaveLength(1);
    expect(home?.categories[0]?.id).toBe('cat-1');
    expect(home?.products).toHaveLength(1);
    expect(home?.products[0]?.id).toBe('p-1');
  });

  it('продано: available=false и категория null сохраняются; originalPrice=null без скидки', () => {
    const home = mapStorefrontHome({
      store: baseStore,
      products: [
        {
          id: 'p-1',
          title: 'Sold out',
          categoryId: null,
          imageUrl: null,
          price: 100000,
          originalPrice: null,
          available: false,
        },
      ],
    });
    const card = home?.products[0];
    expect(card).toEqual({
      id: 'p-1',
      title: 'Sold out',
      categoryId: null,
      imageUrl: null,
      price: 100000,
      originalPrice: null,
      available: false,
    });
  });

  it('пустые строки URL → null; неизвестный статус → ACTIVE, PAUSED сохраняется', () => {
    const empty = mapStorefrontHome({
      store: { ...baseStore, bannerUrl: '', sellerAvatarUrl: '' },
    });
    expect(empty?.store.bannerUrl).toBeNull();
    expect(empty?.store.sellerAvatarUrl).toBeNull();

    expect(mapStorefrontHome({ store: { ...baseStore, status: 'WHATEVER' } })?.store.status).toBe(
      'ACTIVE',
    );
    expect(mapStorefrontHome({ store: { ...baseStore, status: 'PAUSED' } })?.store.status).toBe(
      'PAUSED',
    );
  });

  it('числа-строки приводятся к number, битые → 0', () => {
    const home = mapStorefrontHome({
      store: baseStore,
      products: [{ id: 'p-1', title: 'X', price: '249000', originalPrice: 'нет' }],
    });
    expect(home?.products[0]?.price).toBe(249000);
    expect(home?.products[0]?.originalPrice).toBe(0);
  });
});

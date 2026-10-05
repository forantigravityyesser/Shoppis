import { describe, it, expect } from 'vitest';
import {
  mapPublicStoreContext,
  mapStorefrontCatalogPriceBounds,
  mapStorefrontCatalogProductPage,
  mapStorefrontHome,
  mapStorefrontHomeProductPage,
} from './storefront-mappers';

const baseStore = {
  id: 'store-1',
  publicId: 'pub-1',
  name: 'Nike Shop',
  bannerUrl: 'https://cdn/banner.jpg',
  status: 'ACTIVE',
  currencyCode: 'USD',
  currencySymbol: '$',
};

describe('mapStorefrontHome', () => {
  it('возвращает null на пустой ответ', () => {
    expect(mapStorefrontHome(null)).toBeNull();
    expect(mapStorefrontHome(undefined)).toBeNull();
    expect(mapStorefrontHome('nope')).toBeNull();
  });

  it('возвращает null, если магазин отсутствует или без id/publicId', () => {
    expect(mapStorefrontHome({ categories: [] })).toBeNull();
    expect(mapStorefrontHome({ store: { id: 'x' } })).toBeNull();
    expect(mapStorefrontHome({ store: { publicId: 'x' } })).toBeNull();
  });

  it('маппит store + categories (без products)', () => {
    expect(
      mapStorefrontHome({
        store: baseStore,
        categories: [{ id: 'cat-1', name: 'Обувь', imageUrl: 'https://cdn/cat.jpg', sortOrder: 2 }],
        products: [{ id: 'p-1', title: 'ignored' }],
      }),
    ).toEqual({
      store: {
        id: 'store-1',
        publicId: 'pub-1',
        name: 'Nike Shop',
        bannerUrl: 'https://cdn/banner.jpg',
        status: 'ACTIVE',
        currencyCode: 'USD',
        currencySymbol: '$',
      },
      categories: [{ id: 'cat-1', name: 'Обувь', imageUrl: 'https://cdn/cat.jpg', sortOrder: 2 }],
    });
  });

  it('пустой/отсутствующий список категорий → []', () => {
    expect(mapStorefrontHome({ store: baseStore })?.categories).toEqual([]);
  });

  it('фильтрует некорректные категории', () => {
    const home = mapStorefrontHome({
      store: baseStore,
      categories: [null, { name: 'Без id' }, { id: 'cat-1', name: 'Обувь' }],
    });
    expect(home?.categories).toHaveLength(1);
    expect(home?.categories[0]?.id).toBe('cat-1');
  });

  it('пустой bannerUrl → null; неизвестный статус → ACTIVE, PAUSED сохраняется', () => {
    expect(mapStorefrontHome({ store: { ...baseStore, bannerUrl: '' } })?.store.bannerUrl).toBeNull();
    expect(mapStorefrontHome({ store: { ...baseStore, status: 'WHATEVER' } })?.store.status).toBe(
      'ACTIVE',
    );
    expect(mapStorefrontHome({ store: { ...baseStore, status: 'PAUSED' } })?.store.status).toBe(
      'PAUSED',
    );
  });
});

describe('mapStorefrontHomeProductPage', () => {
  it('возвращает null на некорректный ответ', () => {
    expect(mapStorefrontHomeProductPage(null)).toBeNull();
    expect(mapStorefrontHomeProductPage(undefined)).toBeNull();
    expect(mapStorefrontHomeProductPage('nope')).toBeNull();
  });

  it('маппит products + nextCursor', () => {
    const page = mapStorefrontHomeProductPage({
      products: [
        {
          id: 'p-1',
          title: 'Nike T-Shirt',
          categoryId: 'cat-1',
          imageUrl: 'https://cdn/thumb.jpg',
          price: 249000,
          available: true,
        },
      ],
      nextCursor: '1790797824125169:f2dbdb71-a1c7-4c49-8164-75f6a3fd73dc',
    });
    expect(page).toEqual({
      products: [
        {
          id: 'p-1',
          title: 'Nike T-Shirt',
          categoryId: 'cat-1',
          imageUrl: 'https://cdn/thumb.jpg',
          price: 249000,
          available: true,
        },
      ],
      nextCursor: '1790797824125169:f2dbdb71-a1c7-4c49-8164-75f6a3fd73dc',
    });
  });

  it('отсутствующий/пустой nextCursor → null; пустой products → []', () => {
    expect(mapStorefrontHomeProductPage({ products: [] })).toEqual({
      products: [],
      nextCursor: null,
    });
    expect(mapStorefrontHomeProductPage({ products: [], nextCursor: '' })?.nextCursor).toBeNull();
    expect(mapStorefrontHomeProductPage({})?.products).toEqual([]);
  });

  it('фильтрует некорректные товары; sold out / категория null сохраняются', () => {
    const page = mapStorefrontHomeProductPage({
      products: [
        'bad',
        { title: 'Без id' },
        {
          id: 'p-1',
          title: 'Sold out',
          categoryId: null,
          imageUrl: null,
          price: 100000,
          available: false,
        },
      ],
    });
    expect(page?.products).toHaveLength(1);
    expect(page?.products[0]).toEqual({
      id: 'p-1',
      title: 'Sold out',
      categoryId: null,
      imageUrl: null,
      price: 100000,
      available: false,
    });
  });

  it('цена-строка приводится к number, битая → 0', () => {
    const page = mapStorefrontHomeProductPage({
      products: [{ id: 'p-1', title: 'X', price: '249000' }],
    });
    expect(page?.products[0]?.price).toBe(249000);
  });
});

describe('mapPublicStoreContext', () => {
  it('возвращает null на некорректный ответ', () => {
    expect(mapPublicStoreContext(null)).toBeNull();
    expect(mapPublicStoreContext(undefined)).toBeNull();
    expect(mapPublicStoreContext('nope')).toBeNull();
    expect(mapPublicStoreContext({ name: 'no ids' })).toBeNull();
    expect(mapPublicStoreContext({ id: 's1' })).toBeNull();
    expect(mapPublicStoreContext({ publicId: 'pub1' })).toBeNull();
  });

  it('маппит минимальную проекцию (без owner-полей)', () => {
    expect(
      mapPublicStoreContext({
        id: 's1',
        publicId: 'pub1',
        name: 'Nike',
        status: 'PAUSED',
        supportHandle: 'john',
        logoUrl: 'https://cdn/logo.jpg',
      }),
    ).toEqual({
      id: 's1',
      publicId: 'pub1',
      name: 'Nike',
      status: 'PAUSED',
      supportHandle: 'john',
      logoUrl: 'https://cdn/logo.jpg',
    });
  });

  it('пустые строки → null; неизвестный статус → ACTIVE', () => {
    const ctx = mapPublicStoreContext({
      id: 's1',
      publicId: 'pub1',
      name: '',
      status: 'WHATEVER',
      supportHandle: '',
      logoUrl: '',
    });
    expect(ctx).toEqual({
      id: 's1',
      publicId: 'pub1',
      name: '',
      status: 'ACTIVE',
      supportHandle: null,
      logoUrl: null,
    });
  });
});

describe('mapStorefrontCatalogProductPage', () => {
  it('возвращает null на некорректный ответ', () => {
    expect(mapStorefrontCatalogProductPage(null)).toBeNull();
    expect(mapStorefrontCatalogProductPage(undefined)).toBeNull();
    expect(mapStorefrontCatalogProductPage('nope')).toBeNull();
  });

  it('маппит products + nextCursor (та же карточка, что на Home)', () => {
    const page = mapStorefrontCatalogProductPage({
      products: [
        {
          id: 'p-1',
          title: 'Nike T-Shirt',
          categoryId: 'cat-1',
          imageUrl: 'https://cdn/thumb.jpg',
          price: 249000,
          available: true,
        },
      ],
      nextCursor: '1790797824125169:f2dbdb71-a1c7-4c49-8164-75f6a3fd73dc',
    });
    expect(page).toEqual({
      products: [
        {
          id: 'p-1',
          title: 'Nike T-Shirt',
          categoryId: 'cat-1',
          imageUrl: 'https://cdn/thumb.jpg',
          price: 249000,
          available: true,
        },
      ],
      nextCursor: '1790797824125169:f2dbdb71-a1c7-4c49-8164-75f6a3fd73dc',
    });
  });

  it('пустой ответ → products [], nextCursor null; некорректные карточки отбрасываются', () => {
    expect(mapStorefrontCatalogProductPage({})).toEqual({ products: [], nextCursor: null });
    const page = mapStorefrontCatalogProductPage({
      products: ['bad', { title: 'без id' }, { id: 'p-1', title: 'X' }],
      nextCursor: '',
    });
    expect(page?.products.map((p) => p.id)).toEqual(['p-1']);
    expect(page?.nextCursor).toBeNull();
  });
});

describe('mapStorefrontCatalogPriceBounds', () => {
  it('возвращает null на некорректный ответ', () => {
    expect(mapStorefrontCatalogPriceBounds(null)).toBeNull();
    expect(mapStorefrontCatalogPriceBounds(undefined)).toBeNull();
    expect(mapStorefrontCatalogPriceBounds('nope')).toBeNull();
  });

  it('маппит minPrice/maxPrice; строки приводятся к number', () => {
    expect(mapStorefrontCatalogPriceBounds({ minPrice: 8000, maxPrice: 320000 })).toEqual({
      minPrice: 8000,
      maxPrice: 320000,
    });
    expect(mapStorefrontCatalogPriceBounds({ minPrice: '8000', maxPrice: '320000' })).toEqual({
      minPrice: 8000,
      maxPrice: 320000,
    });
  });

  it('пустой магазин (null-границы) сохраняется; битые значения → null', () => {
    expect(mapStorefrontCatalogPriceBounds({ minPrice: null, maxPrice: null })).toEqual({
      minPrice: null,
      maxPrice: null,
    });
    expect(mapStorefrontCatalogPriceBounds({ minPrice: 'oops' })).toEqual({
      minPrice: null,
      maxPrice: null,
    });
  });
});

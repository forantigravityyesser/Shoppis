import { describe, it, expect } from 'vitest';
import {
  mapStorefrontProductDetail,
  mapStorefrontProductQuestions,
  mapStorefrontProductReviews,
} from './storefront-product-mappers';

const baseStore = {
  id: 'store-1',
  publicId: 'pub-1',
  name: 'Nike Shop',
  bannerUrl: 'https://cdn/banner.jpg',
  status: 'ACTIVE',
  currencyCode: 'USD',
  currencySymbol: '$',
};

const fullDetail = {
  store: baseStore,
  product: { id: 'p-1', title: 'Nike T-Shirt', description: 'Soft cotton', categoryId: 'cat-1' },
  images: [
    { url: 'https://cdn/full1.jpg', thumbUrl: 'https://cdn/thumb1.jpg', sortOrder: 0 },
    { url: 'https://cdn/full2.jpg', thumbUrl: null, sortOrder: 1 },
  ],
  linkAttributes: [{ name: 'Color', value: 'White' }],
  attributes: [
    { name: 'Материал', value: 'Хлопок' },
    { name: 'Бренд', value: 'Nike' },
  ],
  variants: [
    {
      id: 'v-1',
      name: 'Размер',
      value: 'S',
      price: 249000,
      originalPrice: 349000,
      availableQuantity: 5,
      available: true,
    },
    {
      id: 'v-2',
      name: 'Размер',
      value: 'M',
      price: 279000,
      originalPrice: null,
      availableQuantity: 0,
      available: false,
    },
  ],
  rating: { average: 4.5, count: 12 },
  questionsCount: 3,
  relatedProducts: [
    {
      id: 'r-1',
      title: 'Nike T-Shirt Black',
      imageUrl: 'https://cdn/rel.jpg',
      price: 249000,
      originalPrice: null,
      available: true,
    },
  ],
};

describe('mapStorefrontProductDetail', () => {
  it('возвращает null на пустой/некорректный ответ', () => {
    expect(mapStorefrontProductDetail(null)).toBeNull();
    expect(mapStorefrontProductDetail(undefined)).toBeNull();
    expect(mapStorefrontProductDetail('nope')).toBeNull();
  });

  it('возвращает null без store или product', () => {
    expect(mapStorefrontProductDetail({ product: { id: 'p-1' } })).toBeNull();
    expect(mapStorefrontProductDetail({ store: baseStore })).toBeNull();
    expect(mapStorefrontProductDetail({ store: baseStore, product: { title: 'no id' } })).toBeNull();
  });

  it('маппит полный ответ', () => {
    const mapped = mapStorefrontProductDetail(fullDetail);
    expect(mapped).toEqual({
      store: {
        id: 'store-1',
        publicId: 'pub-1',
        name: 'Nike Shop',
        bannerUrl: 'https://cdn/banner.jpg',
        status: 'ACTIVE',
        currencyCode: 'USD',
        currencySymbol: '$',
      },
      product: { id: 'p-1', title: 'Nike T-Shirt', description: 'Soft cotton', categoryId: 'cat-1' },
      images: [
        { url: 'https://cdn/full1.jpg', thumbUrl: 'https://cdn/thumb1.jpg', sortOrder: 0 },
        { url: 'https://cdn/full2.jpg', thumbUrl: null, sortOrder: 1 },
      ],
      linkAttributes: [{ name: 'Color', value: 'White' }],
      attributes: [
        { name: 'Материал', value: 'Хлопок' },
        { name: 'Бренд', value: 'Nike' },
      ],
      variants: [
        {
          id: 'v-1',
          name: 'Размер',
          value: 'S',
          price: 249000,
          originalPrice: 349000,
          availableQuantity: 5,
          available: true,
        },
        {
          id: 'v-2',
          name: 'Размер',
          value: 'M',
          price: 279000,
          originalPrice: null,
          availableQuantity: 0,
          available: false,
        },
      ],
      rating: { average: 4.5, count: 12 },
      questionsCount: 3,
      relatedProducts: [
        {
          id: 'r-1',
          title: 'Nike T-Shirt Black',
          imageUrl: 'https://cdn/rel.jpg',
          price: 249000,
          originalPrice: null,
          available: true,
        },
      ],
    });
  });

  it('пустые/отсутствующие списки → [] и rating 0/0', () => {
    const mapped = mapStorefrontProductDetail({ store: baseStore, product: { id: 'p-1' } });
    expect(mapped?.images).toEqual([]);
    expect(mapped?.linkAttributes).toEqual([]);
    expect(mapped?.attributes).toEqual([]);
    expect(mapped?.variants).toEqual([]);
    expect(mapped?.relatedProducts).toEqual([]);
    expect(mapped?.rating).toEqual({ average: 0, count: 0 });
    expect(mapped?.questionsCount).toBe(0);
  });

  it('фильтрует некорректные элементы: картинка без url, вариант без id', () => {
    const mapped = mapStorefrontProductDetail({
      store: baseStore,
      product: { id: 'p-1' },
      images: [null, { thumbUrl: 'x' }, { url: 'https://cdn/ok.jpg' }, 'bad'],
      variants: [{ name: 'Без id' }, { id: 'v-1', value: 'S' }],
    });
    expect(mapped?.images).toHaveLength(1);
    expect(mapped?.images[0]?.url).toBe('https://cdn/ok.jpg');
    expect(mapped?.variants).toHaveLength(1);
    expect(mapped?.variants[0]?.id).toBe('v-1');
  });

  it('числа-строки приводятся к number, битые → 0; unavailable сохраняется', () => {
    const mapped = mapStorefrontProductDetail({
      store: baseStore,
      product: { id: 'p-1' },
      images: [{ url: 'u', sortOrder: '2' }],
      rating: { average: '4.5', count: '3' },
      questionsCount: '7',
      variants: [{ id: 'v-1', price: '100', originalPrice: 'nope', availableQuantity: 'x' }],
    });
    expect(mapped?.images[0]?.sortOrder).toBe(2);
    expect(mapped?.rating).toEqual({ average: 4.5, count: 3 });
    expect(mapped?.questionsCount).toBe(7);
    expect(mapped?.variants[0]).toMatchObject({
      price: 100,
      originalPrice: 0,
      availableQuantity: 0,
      available: false,
    });
  });

  it('неизвестный статус магазина → ACTIVE, PAUSED сохраняется', () => {
    const active = mapStorefrontProductDetail({
      store: { ...baseStore, status: 'WHATEVER' },
      product: { id: 'p-1' },
    });
    expect(active?.store.status).toBe('ACTIVE');
    const paused = mapStorefrontProductDetail({
      store: { ...baseStore, status: 'PAUSED' },
      product: { id: 'p-1' },
    });
    expect(paused?.store.status).toBe('PAUSED');
  });
});

describe('mapStorefrontProductReviews', () => {
  it('на пустой ответ → дефолты (5 бакетов, canReview=true, без viewer)', () => {
    const mapped = mapStorefrontProductReviews(null);
    expect(mapped.summary).toEqual({ average: 0, count: 0 });
    expect(mapped.reviews).toEqual([]);
    expect(mapped.viewerReview).toBeNull();
    expect(mapped.canReview).toBe(true);
    expect(mapped.distribution).toEqual([
      { rating: 5, count: 0 },
      { rating: 4, count: 0 },
      { rating: 3, count: 0 },
      { rating: 2, count: 0 },
      { rating: 1, count: 0 },
    ]);
  });

  it('маппит summary, distribution, отзывы с ответами и контекст зрителя', () => {
    const mapped = mapStorefrontProductReviews({
      summary: { average: 4.7, count: 2 },
      distribution: [
        { rating: 5, count: 2 },
        { rating: 4, count: 0 },
        { rating: 3, count: 0 },
        { rating: 2, count: 0 },
        { rating: 1, count: 0 },
      ],
      viewerReview: { id: 'r-1', rating: 5, text: 'Мой', createdAt: 't1' },
      canReview: false,
      reviews: [
        {
          id: 'r-1',
          authorName: 'Алексей',
          rating: 5,
          text: 'Отлично',
          createdAt: 't1',
          isOwn: true,
          replies: [
            {
              id: 'rp-1',
              authorName: 'Оля',
              authorType: 'SELLER',
              text: 'Спасибо',
              createdAt: 't2',
              isOwn: false,
            },
          ],
        },
        { id: 'r-2', authorName: '', rating: 3, text: 'Норм', createdAt: 't3' },
        { authorName: 'Без id', rating: 4 },
      ],
    });

    expect(mapped.summary).toEqual({ average: 4.7, count: 2 });
    expect(mapped.distribution[0]).toEqual({ rating: 5, count: 2 });
    expect(mapped.viewerReview).toEqual({ id: 'r-1', rating: 5, text: 'Мой', createdAt: 't1' });
    expect(mapped.canReview).toBe(false);
    expect(mapped.reviews).toHaveLength(2);
    expect(mapped.reviews[0]).toEqual({
      id: 'r-1',
      authorName: 'Алексей',
      rating: 5,
      text: 'Отлично',
      createdAt: 't1',
      isOwn: true,
      replies: [
        {
          id: 'rp-1',
          authorName: 'Оля',
          authorType: 'SELLER',
          text: 'Спасибо',
          createdAt: 't2',
          isOwn: false,
        },
      ],
    });
    expect(mapped.reviews[1]).toMatchObject({ authorName: 'Покупатель', isOwn: false, replies: [] });
  });

  it('distribution → дефолт, если массив пуст/некорректен', () => {
    const mapped = mapStorefrontProductReviews({
      summary: { average: 0, count: 0 },
      distribution: [],
    });
    expect(mapped.distribution).toHaveLength(5);
    expect(mapped.distribution.every((d) => d.count === 0)).toBe(true);
  });
});

describe('mapStorefrontProductQuestions', () => {
  it('на пустой ответ → дефолт (пустая лента, canAsk)', () => {
    expect(mapStorefrontProductQuestions(null)).toEqual({
      questions: [],
      viewerQuestion: null,
      canAsk: true,
    });
  });

  it('маппит вопрос с ответом и без; fallback имени; isOwn', () => {
    const mapped = mapStorefrontProductQuestions({
      questions: [
        {
          id: 'q-1',
          authorName: 'Мария',
          text: 'Подойдёт M?',
          createdAt: 't1',
          isOwn: true,
          answer: { text: 'Да', createdAt: 't2' },
        },
        { id: 'q-2', authorName: '', text: 'Когда?', createdAt: 't3', answer: null },
        { authorName: 'Без id' },
      ],
    });
    expect(mapped.questions).toHaveLength(2);
    expect(mapped.questions[0]).toEqual({
      id: 'q-1',
      authorName: 'Мария',
      text: 'Подойдёт M?',
      createdAt: 't1',
      isOwn: true,
      answer: { text: 'Да', createdAt: 't2' },
    });
    expect(mapped.questions[1]?.isOwn).toBe(false);
    expect(mapped.questions[1]?.answer).toBeNull();
    expect(mapped.questions[1]?.authorName).toBe('Покупатель');
  });

  it('маппит viewerQuestion и canAsk=false', () => {
    const mapped = mapStorefrontProductQuestions({
      viewerQuestion: { id: 'q-1', text: 'Мой вопрос', createdAt: 't1' },
      canAsk: false,
      questions: [],
    });
    expect(mapped.viewerQuestion).toEqual({ id: 'q-1', text: 'Мой вопрос', createdAt: 't1' });
    expect(mapped.canAsk).toBe(false);
  });
});

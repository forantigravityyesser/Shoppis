import { describe, it, expect, vi, beforeEach } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../insforge/client', () => ({ insforge: { database: { rpc } } }));

import {
  loadProductDetail,
  loadProductQuestions,
  loadProductReviews,
} from './storefront-product-repository';

const DETAIL = {
  store: {
    id: 's1',
    publicId: 'pub1',
    name: 'Nike',
    bannerUrl: null,
    status: 'ACTIVE',
    currencyCode: 'USD',
    currencySymbol: '$',
  },
  product: { id: 'p1', title: 'T-Shirt', description: '', categoryId: null },
  images: [],
  linkAttributes: [],
  attributes: [],
  variants: [],
  rating: { average: 0, count: 0 },
  questionsCount: 0,
  relatedProducts: [],
};

beforeEach(() => rpc.mockReset());

describe('loadProductDetail', () => {
  it('не ходит в сеть без public_id/product_id', async () => {
    expect(await loadProductDetail('', 'p1')).toBeNull();
    expect(await loadProductDetail('pub1', '')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('вызывает rpc с параметрами и маппит ответ', async () => {
    rpc.mockResolvedValue({ data: DETAIL, error: null });

    const detail = await loadProductDetail('pub1', 'p1');

    expect(rpc).toHaveBeenCalledWith('storefront_product_detail_read', {
      p_public_id: 'pub1',
      p_product_id: 'p1',
    });
    expect(detail?.store.publicId).toBe('pub1');
    expect(detail?.product.id).toBe('p1');
  });

  it('null data → null (товар не найден)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadProductDetail('pub1', 'missing')).toBeNull();
  });

  it('бросает ошибку транспорта', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(loadProductDetail('pub1', 'p1')).rejects.toThrow('boom');
  });
});

describe('loadProductReviews', () => {
  it('без id → пустая лента, без сети', async () => {
    const result = await loadProductReviews('', 'p1', null);
    expect(result.reviews).toEqual([]);
    expect(result.canReview).toBe(true);
    expect(result.distribution).toHaveLength(5);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('вызывает rpc с viewer id и маппит ответ', async () => {
    rpc.mockResolvedValue({
      data: {
        summary: { average: 4.7, count: 2 },
        distribution: [{ rating: 5, count: 2 }],
        viewerReview: { id: 'r1', rating: 5, text: 'Мой', createdAt: 't' },
        canReview: false,
        reviews: [
          { id: 'r1', authorName: 'Алексей', rating: 5, text: 'Ок', createdAt: 't', isOwn: true, replies: [] },
        ],
      },
      error: null,
    });

    const result = await loadProductReviews('pub1', 'p1', 'u1');

    expect(rpc).toHaveBeenCalledWith('storefront_product_reviews_read', {
      p_public_id: 'pub1',
      p_product_id: 'p1',
      p_viewer_user_id: 'u1',
    });
    expect(result.summary).toEqual({ average: 4.7, count: 2 });
    expect(result.reviews).toHaveLength(1);
    expect(result.canReview).toBe(false);
  });

  it('null data → дефолтная лента', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const result = await loadProductReviews('pub1', 'p1', null);
    expect(result.reviews).toEqual([]);
    expect(result.distribution).toHaveLength(5);
  });

  it('бросает ошибку транспорта', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(loadProductReviews('pub1', 'p1', null)).rejects.toThrow('boom');
  });
});

describe('loadProductQuestions', () => {
  it('без id → дефолтная лента, без сети', async () => {
    const result = await loadProductQuestions('', 'p1', null);
    expect(result.questions).toEqual([]);
    expect(result.canAsk).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('вызывает rpc с viewer и маппит ответ', async () => {
    rpc.mockResolvedValue({
      data: {
        canAsk: false,
        viewerQuestion: { id: 'q1', text: 'Мой вопрос', createdAt: 't1' },
        questions: [
          {
            id: 'q1',
            authorName: 'Мария',
            text: 'Подойдёт M?',
            createdAt: 't1',
            isOwn: true,
            answer: { text: 'Да', createdAt: 't2' },
          },
        ],
      },
      error: null,
    });

    const result = await loadProductQuestions('pub1', 'p1', 'u1');

    expect(rpc).toHaveBeenCalledWith('storefront_product_questions_read', {
      p_public_id: 'pub1',
      p_product_id: 'p1',
      p_viewer_user_id: 'u1',
    });
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]?.answer?.text).toBe('Да');
    expect(result.questions[0]?.isOwn).toBe(true);
    expect(result.canAsk).toBe(false);
    expect(result.viewerQuestion?.id).toBe('q1');
  });

  it('null data → пустая лента', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const result = await loadProductQuestions('pub1', 'p1', null);
    expect(result.questions).toEqual([]);
  });

  it('бросает ошибку транспорта', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(loadProductQuestions('pub1', 'p1', null)).rejects.toThrow('boom');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { loadSellerReviews, loadSellerQuestions } = vi.hoisted(() => ({
  loadSellerReviews: vi.fn(),
  loadSellerQuestions: vi.fn(),
}));

vi.mock('../functions/review-api', () => ({ loadSellerReviews }));
vi.mock('../functions/question-api', () => ({ loadSellerQuestions }));

import { loadProductQuestions, loadProductReviews } from './seller-product-social-repository';

beforeEach(() => {
  loadSellerReviews.mockReset();
  loadSellerQuestions.mockReset();
});

describe('seller-product-social-repository', () => {
  it('без productId/token → дефолтная проекция, без сети', async () => {
    const reviews = await loadProductReviews('', 'tok');
    expect(reviews.reviews).toEqual([]);
    expect(reviews.distribution).toHaveLength(5);
    expect(loadSellerReviews).not.toHaveBeenCalled();
  });

  it('loadProductReviews → edge-api + маппинг', async () => {
    loadSellerReviews.mockResolvedValue({
      summary: { average: 4.5, count: 2 },
      distribution: [{ rating: 5, count: 2 }],
      canReview: false,
      viewerReview: null,
      reviews: [
        {
          id: 'r1',
          authorName: 'A',
          rating: 5,
          text: 'ok',
          createdAt: 't',
          isOwn: false,
          replies: [],
        },
      ],
    });

    const result = await loadProductReviews('p1', 'tok');

    expect(loadSellerReviews).toHaveBeenCalledWith('tok', 'p1');
    expect(result.summary).toEqual({ average: 4.5, count: 2 });
    expect(result.reviews).toHaveLength(1);
  });

  it('loadProductQuestions → edge-api + маппинг', async () => {
    loadSellerQuestions.mockResolvedValue({
      canAsk: true,
      viewerQuestion: null,
      questions: [
        {
          id: 'q1',
          authorName: 'M',
          text: '?',
          createdAt: 't',
          isOwn: false,
          answer: null,
        },
      ],
    });

    const result = await loadProductQuestions('p1', 'tok');

    expect(loadSellerQuestions).toHaveBeenCalledWith('tok', 'p1');
    expect(result.questions).toHaveLength(1);
  });

  it('бросает ошибку транспорта', async () => {
    loadSellerReviews.mockRejectedValue(new Error('FORBIDDEN'));
    await expect(loadProductReviews('p1', 'tok')).rejects.toThrow('FORBIDDEN');
  });
});

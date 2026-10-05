import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeFunction } = vi.hoisted(() => ({ invokeFunction: vi.fn() }));

vi.mock('../insforge/functions-gateway', () => ({ invokeFunction }));

import { createReview, hideReview, loadSellerReviews, replyToReview } from './review-api';

beforeEach(() => invokeFunction.mockReset());

describe('review-api', () => {
  it('createReview → review-actions с action и payload', async () => {
    invokeFunction.mockResolvedValue({ data: { success: true }, error: null });

    await createReview('tok', 'p1', 5, 'Отлично');

    expect(invokeFunction).toHaveBeenCalledWith('review-actions', {
      token: 'tok',
      body: { action: 'review-create', productId: 'p1', rating: 5, text: 'Отлично' },
    });
  });

  it('hideReview / replyToReview → корректные action', async () => {
    invokeFunction.mockResolvedValue({ data: { success: true }, error: null });

    await hideReview('tok', 'r1');
    expect(invokeFunction).toHaveBeenCalledWith('review-actions', {
      token: 'tok',
      body: { action: 'review-hide', reviewId: 'r1' },
    });

    await replyToReview('tok', 'r1', 'Согласен');
    expect(invokeFunction).toHaveBeenCalledWith('review-actions', {
      token: 'tok',
      body: { action: 'review-reply', reviewId: 'r1', text: 'Согласен' },
    });
  });

  it('loadSellerReviews → review-seller-read и возвращает result', async () => {
    const projection = { summary: { average: 0, count: 0 }, reviews: [] };
    invokeFunction.mockResolvedValue({ data: { success: true, result: projection }, error: null });

    const result = await loadSellerReviews('tok', 'p1');

    expect(invokeFunction).toHaveBeenCalledWith('review-actions', {
      token: 'tok',
      body: { action: 'review-seller-read', productId: 'p1' },
    });
    expect(result).toEqual(projection);
  });

  it('бросает код ошибки от edge', async () => {
    invokeFunction.mockResolvedValue({
      data: null,
      error: { message: 'ALREADY_REVIEWED', status: 409 },
    });
    await expect(createReview('tok', 'p1', 5, '')).rejects.toThrow('ALREADY_REVIEWED');
  });

  it('бросает, если success=false', async () => {
    invokeFunction.mockResolvedValue({ data: { success: false, error: 'FORBIDDEN' }, error: null });
    await expect(hideReview('tok', 'r1')).rejects.toThrow('FORBIDDEN');
  });
});

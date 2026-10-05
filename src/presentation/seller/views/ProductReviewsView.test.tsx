// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';

const { reviewsState, refresh, createReview, hideReview, replyToReview, errorRef } = vi.hoisted(
  () => ({
    reviewsState: { current: {} as Record<string, unknown> },
    refresh: vi.fn(),
    createReview: vi.fn(),
    hideReview: vi.fn(),
    replyToReview: vi.fn(),
    errorRef: { current: null as string | null },
  }),
);

vi.mock('../../../application/store', () => ({
  useStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      currentStore: { publicId: 'pub1' },
      serverUser: { id: 'seller1' },
    }),
}));

vi.mock('../../../application/hooks/useSellerProductSocial', () => ({
  useSellerProductReviews: () => reviewsState.current,
}));

vi.mock('../../../application/hooks/useReviewActions', () => ({
  useReviewActions: () => ({
    createReview,
    hideReview,
    replyToReview,
    pending: false,
    error: errorRef.current,
  }),
}));

vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({
    impactLight: vi.fn(),
    impactMedium: vi.fn(),
    notifySuccess: vi.fn(),
    selectTick: vi.fn(),
  }),
}));

import ProductReviewsView from './ProductReviewsView';
import { seenReviewIds } from '../../../application/hooks/useSellerSocialSeen';

const EMPTY_DIST = [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 }));

const review = {
  id: 'r1',
  authorName: 'Алексей',
  rating: 4,
  text: 'Хорошо',
  createdAt: '2026-10-01T00:00:00.000Z',
  isOwn: false,
  replies: [] as Array<Record<string, unknown>>,
};

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/seller/inventory/product/p1/reviews']}>
      <Routes>
        <Route path="/seller/inventory/product/:productId/reviews" element={<ProductReviewsView />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  refresh.mockReset();
  createReview.mockReset();
  hideReview.mockReset().mockResolvedValue(undefined);
  replyToReview.mockReset().mockResolvedValue(undefined);
  errorRef.current = null;
  reviewsState.current = {
    summary: { average: 0, count: 0 },
    distribution: EMPTY_DIST,
    reviews: [],
    viewerReview: null,
    canReview: true,
    loading: false,
    error: null,
    refresh,
  };
});

describe('seller ProductReviewsView', () => {
  it('loading → «Загрузка…»', () => {
    reviewsState.current = { ...reviewsState.current, loading: true };
    renderTab();
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });

  it('пусто → гистограмма + «Пока нет отзывов», без композера', () => {
    renderTab();
    expect(screen.getByTestId('seller-product-reviews')).toBeInTheDocument();
    expect(screen.getByTestId('reviews-histogram')).toBeInTheDocument();
    expect(screen.getByText('Пока нет отзывов')).toBeInTheDocument();
    expect(screen.queryByTestId('review-composer')).toBeNull();
  });

  it('ответ продавца → replyToReview', async () => {
    reviewsState.current = { ...reviewsState.current, reviews: [review] };
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Ответить' }));
    await userEvent.type(screen.getByPlaceholderText('Ответ от магазина'), 'Спасибо за отзыв');
    await userEvent.click(screen.getByRole('button', { name: 'Ответить' }));

    expect(replyToReview).toHaveBeenCalledWith('r1', 'Спасибо за отзыв');
  });

  it('при открытой форме ответа «Удалить отзыв» скрыта', async () => {
    reviewsState.current = { ...reviewsState.current, reviews: [review] };
    renderTab();

    expect(screen.getByRole('button', { name: 'Удалить отзыв' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ответить' }));
    expect(screen.getByPlaceholderText('Ответ от магазина')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить отзыв' })).toBeNull();
  });

  it('удаление отзыва продавцом → hideReview', async () => {
    reviewsState.current = { ...reviewsState.current, reviews: [review] };
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить отзыв' }));
    expect(hideReview).toHaveBeenCalledWith('r1');
  });

  it('если продавец уже ответил — кнопки «Ответить» нет, ответ помечен', () => {
    reviewsState.current = {
      ...reviewsState.current,
      reviews: [
        {
          ...review,
          replies: [
            {
              id: 'rp1',
              authorName: 'Оля',
              authorType: 'SELLER',
              text: 'Спасибо!',
              createdAt: '2026-10-02T00:00:00.000Z',
              isOwn: true,
            },
          ],
        },
      ],
    };
    renderTab();
    expect(screen.queryByRole('button', { name: 'Ответить' })).toBeNull();
    expect(screen.getByText('Продавец')).toBeInTheDocument();
    expect(screen.getByText('Спасибо!')).toBeInTheDocument();
  });

  it('ошибка → сообщение и повтор', async () => {
    reviewsState.current = { ...reviewsState.current, error: 'boom' };
    renderTab();

    expect(screen.getByText('Не удалось загрузить отзывы.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('открытие вкладки помечает отзывы просмотренными', () => {
    reviewsState.current = { ...reviewsState.current, reviews: [review] };
    renderTab();
    expect(seenReviewIds('p1').has('r1')).toBe(true);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';

const { reviewsState, refresh, createReview, hideReview, replyToReview, actionsErrorRef } =
  vi.hoisted(() => ({
    reviewsState: { current: {} as Record<string, unknown> },
    refresh: vi.fn(),
    createReview: vi.fn(),
    hideReview: vi.fn(),
    replyToReview: vi.fn(),
    actionsErrorRef: { current: null as string | null },
  }));

vi.mock('../../../../application/store', () => ({
  useStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      viewedStore: { publicId: 'pub1' },
      serverUser: { id: 'u1', firstName: 'Алексей' },
    }),
}));

vi.mock('../../../../application/hooks/useStorefrontProduct', () => ({
  useStorefrontProductReviews: () => reviewsState.current,
}));

vi.mock('../../../../application/hooks/useReviewActions', () => ({
  useReviewActions: () => ({
    createReview,
    hideReview,
    replyToReview,
    pending: false,
    error: actionsErrorRef.current,
  }),
}));

vi.mock('../../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({
    impactLight: vi.fn(),
    impactMedium: vi.fn(),
    notifySuccess: vi.fn(),
    selectTick: vi.fn(),
  }),
}));

import ProductReviewsView from './ProductReviewsView';

const EMPTY_DIST = [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 }));

const otherReview = {
  id: 'r1',
  authorName: 'Мария',
  rating: 4,
  text: 'Хорошо',
  createdAt: '2026-10-01T00:00:00.000Z',
  isOwn: false,
  replies: [] as unknown[],
};

function renderReviews() {
  return render(
    <MemoryRouter initialEntries={['/product/p1/reviews']}>
      <Routes>
        <Route path="/product/:id/reviews" element={<ProductReviewsView />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  refresh.mockReset();
  createReview.mockReset().mockResolvedValue(undefined);
  hideReview.mockReset().mockResolvedValue(undefined);
  replyToReview.mockReset().mockResolvedValue(undefined);
  actionsErrorRef.current = null;
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

describe('ProductReviewsView', () => {
  it('loading → «Загрузка…»', () => {
    reviewsState.current = { ...reviewsState.current, loading: true };
    renderReviews();
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });

  it('пусто и canReview=true → гистограмма + композер + «Пока нет отзывов»', () => {
    renderReviews();
    expect(screen.getByTestId('reviews-histogram')).toBeInTheDocument();
    expect(screen.getByTestId('review-composer')).toBeInTheDocument();
    expect(screen.getByText('Пока нет отзывов')).toBeInTheDocument();
  });

  it('canReview=false → вместо композера уведомление', () => {
    reviewsState.current = { ...reviewsState.current, canReview: false };
    renderReviews();
    expect(screen.queryByTestId('review-composer')).toBeNull();
    expect(screen.getByText(/Вы уже оставляли отзыв/)).toBeInTheDocument();
  });

  it('создание: оценка → комментарий → отправка', async () => {
    renderReviews();
    await userEvent.click(screen.getByRole('button', { name: '5 из 5' }));
    await userEvent.type(screen.getByPlaceholderText('Комментарий (необязательно)'), 'Топ');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(createReview).toHaveBeenCalledWith(5, 'Топ');
  });

  it('свой отзыв → «Удалить отзыв» вызывает hideReview', async () => {
    reviewsState.current = {
      ...reviewsState.current,
      canReview: false,
      reviews: [{ ...otherReview, isOwn: true, authorName: 'Вы' }],
    };
    renderReviews();
    await userEvent.click(screen.getByRole('button', { name: 'Удалить отзыв' }));
    expect(hideReview).toHaveBeenCalledWith('r1');
  });

  it('чужой отзыв → ответ (1 раз) вызывает replyToReview', async () => {
    reviewsState.current = {
      ...reviewsState.current,
      canReview: false,
      reviews: [otherReview],
    };
    renderReviews();

    await userEvent.click(screen.getByRole('button', { name: 'Ответить' }));
    await userEvent.type(screen.getByPlaceholderText('Ваш ответ'), 'Согласен');
    await userEvent.click(screen.getByRole('button', { name: 'Ответить' }));

    expect(replyToReview).toHaveBeenCalledWith('r1', 'Согласен');
  });

  it('нельзя ответить, если уже ответил (кнопки «Ответить» нет)', () => {
    reviewsState.current = {
      ...reviewsState.current,
      canReview: false,
      reviews: [
        {
          ...otherReview,
          replies: [
            {
              id: 'rp1',
              authorName: 'Вы',
              authorType: 'BUYER',
              text: 'Уже ответил',
              createdAt: '2026-10-02T00:00:00.000Z',
              isOwn: true,
            },
          ],
        },
      ],
    };
    renderReviews();
    expect(screen.queryByRole('button', { name: 'Ответить' })).toBeNull();
    expect(screen.getByText('Уже ответил')).toBeInTheDocument();
  });

  it('ошибка загрузки → сообщение и повтор', async () => {
    reviewsState.current = { ...reviewsState.current, error: 'boom' };
    renderReviews();

    expect(screen.getByText('Не удалось загрузить отзывы.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

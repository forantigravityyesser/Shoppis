// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

const { productRef, reviewsRef, questionsRef, seenRef } = vi.hoisted(() => ({
  productRef: { current: {} as Record<string, unknown> },
  reviewsRef: { current: { reviews: [] as Array<{ id: string }> } },
  questionsRef: {
    current: { questions: [] as Array<{ id: string; answer: unknown }> },
  },
  seenRef: { current: new Set<string>() },
}));

vi.mock('../../../application/hooks/useProduct', () => ({
  useProductDetail: () => ({ product: productRef.current, loading: false }),
}));

vi.mock('../../../application/hooks/useSellerProductSocial', () => ({
  useSellerProductReviews: () => reviewsRef.current,
  useSellerProductQuestions: () => questionsRef.current,
}));

vi.mock('../../../application/hooks/useSellerSocialSeen', () => ({
  useSeenReviewIds: () => seenRef.current,
}));

vi.mock('../../shared/components/BackButton', () => ({
  default: () => <button type="button">Назад</button>,
}));

import ProductView from './ProductView';

const PRODUCT = {
  id: 'p1',
  title: 'Морковь',
  status: 'ACTIVE',
  images: [],
  emoji: '🥕',
  priceMinor: 10000,
  discountPercent: 0,
  currency: 'RUB',
  categoryName: 'Овощи',
  description: '',
};

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/seller/inventory/product/p1']}>
      <Routes>
        <Route path="/seller/inventory/product/:productId" element={<ProductView />}>
          <Route index element={<div>Карточка-контент</div>} />
          <Route path="reviews" element={<div>Отзывы-контент</div>} />
          <Route path="questions" element={<div>Вопросы-контент</div>} />
          <Route path="preview" element={<div>Витрина-контент</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  productRef.current = { ...PRODUCT };
  reviewsRef.current = { reviews: [] };
  questionsRef.current = { questions: [] };
  seenRef.current = new Set<string>();
});

describe('seller ProductView — вкладки и индикаторы', () => {
  it('сохраняет навигацию по разделам товара', () => {
    renderView();
    for (const label of ['Карточка', 'Отзывы', 'Вопросы', 'Витрина']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('показывает число непросмотренных отзывов и вопросов без ответа', () => {
    reviewsRef.current = { reviews: [{ id: 'r1' }, { id: 'r2' }] };
    seenRef.current = new Set(['r1']);
    questionsRef.current = {
      questions: [
        { id: 'q1', answer: null },
        { id: 'q2', answer: { text: 'да' } },
      ],
    };
    renderView();

    expect(screen.getByRole('link', { name: /Отзывы/ })).toHaveTextContent('1');
    expect(screen.getByRole('link', { name: /Вопросы/ })).toHaveTextContent('1');
  });

  it('убирает бейджи, когда все отзывы просмотрены и вопросы отвечены', () => {
    reviewsRef.current = { reviews: [{ id: 'r1' }] };
    seenRef.current = new Set(['r1']);
    questionsRef.current = { questions: [{ id: 'q1', answer: { text: 'да' } }] };
    renderView();

    expect(
      screen.getByRole('link', { name: /Отзывы/ }).querySelector('.prod-tab__badge'),
    ).toBeNull();
    expect(
      screen.getByRole('link', { name: /Вопросы/ }).querySelector('.prod-tab__badge'),
    ).toBeNull();
  });
});

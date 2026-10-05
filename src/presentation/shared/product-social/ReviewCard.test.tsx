// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StorefrontProductReview } from '../../../application/read-models/storefront-product';
import ReviewCard from './ReviewCard';

const review: StorefrontProductReview = {
  id: 'r1',
  authorName: 'Алексей',
  rating: 4,
  text: 'Отличный товар',
  createdAt: '2026-10-01T00:00:00.000Z',
  isOwn: false,
  replies: [
    {
      id: 'rp1',
      authorName: 'Оля',
      authorType: 'SELLER',
      text: 'Спасибо!',
      createdAt: '2026-10-02T00:00:00.000Z',
      isOwn: false,
    },
  ],
};

describe('ReviewCard', () => {
  it('рендерит автора, текст и ответ продавца', () => {
    render(<ReviewCard review={review} />);

    expect(screen.getByTestId('review-card')).toBeInTheDocument();
    expect(screen.getByText('Алексей')).toBeInTheDocument();
    expect(screen.getByText('Отличный товар')).toBeInTheDocument();
    // Ответ продавца помечен бейджем «Продавец».
    expect(screen.getByText('Продавец')).toBeInTheDocument();
    expect(screen.getByText('Оля')).toBeInTheDocument();
    expect(screen.getByText('Спасибо!')).toBeInTheDocument();
  });

  it('без текста и ответов — блок ответов отсутствует', () => {
    const { container } = render(<ReviewCard review={{ ...review, text: '', replies: [] }} />);
    expect(container.querySelector('.pd-review__replies')).toBeNull();
    expect(container.querySelector('.pd-review__text')).toBeNull();
  });
});

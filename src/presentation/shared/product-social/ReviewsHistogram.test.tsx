// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReviewsHistogram from './ReviewsHistogram';

const dist = [
  { rating: 5, count: 2 },
  { rating: 4, count: 0 },
  { rating: 3, count: 1 },
  { rating: 2, count: 0 },
  { rating: 1, count: 0 },
];

describe('ReviewsHistogram', () => {
  it('рендерит 5 строк, среднюю и число отзывов', () => {
    render(<ReviewsHistogram distribution={dist} summary={{ average: 4.3, count: 3 }} />);

    expect(screen.getByTestId('reviews-histogram')).toBeInTheDocument();
    for (const label of ['5★', '4★', '3★', '2★', '1★']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('3 отзыва')).toBeInTheDocument();
  });

  it('пустая гистограмма — пять нулей и «0 отзывов»', () => {
    const empty = [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 }));
    render(<ReviewsHistogram distribution={empty} summary={{ average: 0, count: 0 }} />);

    expect(screen.getAllByText('0')).toHaveLength(5);
    expect(screen.getByText('0 отзывов')).toBeInTheDocument();
  });
});

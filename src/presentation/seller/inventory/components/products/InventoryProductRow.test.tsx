// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { summaryRef, seenRef } = vi.hoisted(() => ({
  summaryRef: { current: { reviewIds: [] as string[], unansweredQuestions: 0 } },
  seenRef: { current: new Set<string>() },
}));

vi.mock('../../../../../application/hooks/useSellerProductSocial', () => ({
  useSellerProductSocialSummary: () => summaryRef.current,
}));

vi.mock('../../../../../application/hooks/useSellerSocialSeen', () => ({
  useSeenReviewIds: () => seenRef.current,
}));

import InventoryProductRow from './InventoryProductRow';
import type { InventoryProductItem } from '../../../../../application/hooks/useInventory';

const PRODUCT: InventoryProductItem = {
  id: 'p1',
  categoryId: null,
  title: 'Морковь',
  imageUrl: null,
  emoji: '🥕',
  priceMinor: 10000,
  currency: 'RUB',
  stockAvailable: 5,
  stockHeld: 0,
  stockState: 'in_stock',
  status: 'ACTIVE',
  rating: 0,
  reviewsCount: 0,
  questionsCount: 0,
};

function renderRow() {
  return render(<InventoryProductRow product={PRODUCT} onClick={vi.fn()} />);
}

beforeEach(() => {
  summaryRef.current = { reviewIds: [], unansweredQuestions: 0 };
  seenRef.current = new Set<string>();
});

describe('InventoryProductRow — индикатор внимания', () => {
  it('без непрочитанного индикатора нет', () => {
    renderRow();
    expect(screen.getByText('Морковь')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Требуют внимания/)).toBeNull();
  });

  it('считает непросмотренные отзывы (без просмотренных)', () => {
    summaryRef.current = { reviewIds: ['r1', 'r2'], unansweredQuestions: 0 };
    seenRef.current = new Set(['r1']);
    renderRow();
    expect(screen.getByLabelText(/Требуют внимания/)).toHaveTextContent('1');
  });

  it('учитывает вопросы без ответа', () => {
    summaryRef.current = { reviewIds: [], unansweredQuestions: 2 };
    renderRow();
    expect(screen.getByLabelText(/Требуют внимания/)).toHaveTextContent('2');
  });

  it('когда всё просмотрено и отвечено — индикатора нет', () => {
    summaryRef.current = { reviewIds: ['r1'], unansweredQuestions: 0 };
    seenRef.current = new Set(['r1']);
    renderRow();
    expect(screen.queryByLabelText(/Требуют внимания/)).toBeNull();
  });
});

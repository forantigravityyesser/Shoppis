// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { markReviewsSeen, seenReviewIds, unseenReviewIds } from './useSellerSocialSeen';

beforeEach(() => {
  localStorage.clear();
});

describe('seller social seen store', () => {
  it('помечает отзывы прочитанными', () => {
    markReviewsSeen('pA', ['r1', 'r2']);
    expect([...seenReviewIds('pA')].sort()).toEqual(['r1', 'r2']);
  });

  it('идемпотентен и не дублирует id', () => {
    markReviewsSeen('pB', ['r1']);
    markReviewsSeen('pB', ['r1', 'r2']);
    expect([...seenReviewIds('pB')].sort()).toEqual(['r1', 'r2']);
  });

  it('unseenReviewIds отдаёт только непрочитанные', () => {
    markReviewsSeen('pC', ['r1']);
    expect([...unseenReviewIds('pC', ['r1', 'r2', 'r3'])].sort()).toEqual(['r2', 'r3']);
  });

  it('изолирует товары друг от друга', () => {
    markReviewsSeen('pD', ['r1']);
    expect(seenReviewIds('pE').size).toBe(0);
  });

  it('игнорирует пустой список и пустой productId', () => {
    markReviewsSeen('pF', []);
    markReviewsSeen('', ['r1']);
    expect(seenReviewIds('pF').size).toBe(0);
  });
});

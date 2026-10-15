import { describe, expect, it } from 'vitest';
import type { GrowthFacts } from '../models/tutorial';
import { GROWTH_GOAL_ORDER, listGrowthGoals, resolveGrowthGoal } from './growth-rules';

const NONE: GrowthFacts = {
  firstOrderAt: null,
  firstShippedAt: null,
  firstCompletedAt: null,
};

describe('resolveGrowthGoal', () => {
  it('points to the first goal when there are no orders', () => {
    expect(resolveGrowthGoal(NONE)).toEqual({ key: 'first-order', achieved: false });
  });

  it('advances past an achieved first order (e.g. later cancelled) without resetting it', () => {
    const facts: GrowthFacts = { ...NONE, firstOrderAt: '2026-01-01T00:00:00.000Z' };
    expect(resolveGrowthGoal(facts)?.key).toBe('first-shipped');
  });

  it('advances after the first shipment without completing the last goal', () => {
    const facts: GrowthFacts = {
      ...NONE,
      firstOrderAt: 't1',
      firstShippedAt: 't2',
    };
    expect(resolveGrowthGoal(facts)?.key).toBe('first-completed');
  });

  it('returns null when the whole journey is complete', () => {
    const facts: GrowthFacts = { firstOrderAt: 't1', firstShippedAt: 't2', firstCompletedAt: 't3' };
    expect(resolveGrowthGoal(facts)).toBeNull();
  });

  it('does not treat a refused delivery as success (no completed_at)', () => {
    const facts: GrowthFacts = { ...NONE, firstOrderAt: 't1', firstShippedAt: 't2' };
    expect(resolveGrowthGoal(facts)?.key).toBe('first-completed');
  });
});

describe('listGrowthGoals', () => {
  it('keeps the fixed order and marks achieved facts', () => {
    const facts: GrowthFacts = { ...NONE, firstOrderAt: 't1', firstShippedAt: 't2' };
    expect(listGrowthGoals(facts)).toEqual([
      { key: 'first-order', achieved: true },
      { key: 'first-shipped', achieved: true },
      { key: 'first-completed', achieved: false },
    ]);
    expect(GROWTH_GOAL_ORDER).toEqual(['first-order', 'first-shipped', 'first-completed']);
  });
});

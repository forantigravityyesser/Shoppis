import { describe, expect, it } from 'vitest';
import {
  canTransition,
  isAwaitingDeliveryOutcome,
  isCancellable,
  isTerminal,
  nextAllowedStatus,
} from './order-rules';
import type { OrderStatus } from '../models/order';

describe('nextAllowedStatus', () => {
  it('follows the linear sales flow', () => {
    expect(nextAllowedStatus('NEW')).toBe('IN_TRANSIT');
    expect(nextAllowedStatus('IN_TRANSIT')).toBe('DELIVERED');
    expect(nextAllowedStatus('DELIVERED')).toBeNull();
    expect(nextAllowedStatus('REFUSED')).toBeNull();
    expect(nextAllowedStatus('CANCELLED')).toBeNull();
  });
});

describe('isCancellable', () => {
  it('buyer can cancel only NEW', () => {
    expect(isCancellable('NEW', 'buyer')).toBe(true);
    expect(isCancellable('IN_TRANSIT', 'buyer')).toBe(false);
  });

  it('seller can cancel NEW and IN_TRANSIT', () => {
    expect(isCancellable('NEW', 'seller')).toBe(true);
    expect(isCancellable('IN_TRANSIT', 'seller')).toBe(true);
    expect(isCancellable('DELIVERED', 'seller')).toBe(false);
  });
});

describe('isTerminal', () => {
  it('REFUSED and CANCELLED are terminal', () => {
    expect(isTerminal('REFUSED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('NEW')).toBe(false);
    expect(isTerminal('DELIVERED')).toBe(false);
  });
});

describe('isAwaitingDeliveryOutcome', () => {
  it('only DELIVERED awaits an outcome', () => {
    expect(isAwaitingDeliveryOutcome('DELIVERED')).toBe(true);
    expect(isAwaitingDeliveryOutcome('IN_TRANSIT')).toBe(false);
  });
});

describe('canTransition', () => {
  it('rejects identical statuses', () => {
    expect(canTransition('NEW', 'NEW', 'seller')).toBe(false);
  });

  it('allows seller linear transitions', () => {
    expect(canTransition('NEW', 'IN_TRANSIT', 'seller')).toBe(true);
    expect(canTransition('IN_TRANSIT', 'DELIVERED', 'seller')).toBe(true);
    expect(canTransition('DELIVERED', 'REFUSED', 'seller')).toBe(true);
  });

  it('forbids buyer from advancing statuses', () => {
    expect(canTransition('NEW', 'IN_TRANSIT', 'buyer')).toBe(false);
    expect(canTransition('IN_TRANSIT', 'DELIVERED', 'buyer')).toBe(false);
  });

  it('routes cancellation through isCancellable', () => {
    expect(canTransition('NEW', 'CANCELLED', 'buyer')).toBe(true);
    expect(canTransition('NEW', 'CANCELLED', 'seller')).toBe(true);
    expect(canTransition('IN_TRANSIT', 'CANCELLED', 'buyer')).toBe(false);
    expect(canTransition('IN_TRANSIT', 'CANCELLED', 'seller')).toBe(true);
  });

  it('forbids transitions out of terminal states', () => {
    const terminals: OrderStatus[] = ['DELIVERED', 'REFUSED', 'CANCELLED'];
    for (const from of terminals) {
      expect(canTransition(from, 'NEW', 'seller')).toBe(false);
    }
  });
});

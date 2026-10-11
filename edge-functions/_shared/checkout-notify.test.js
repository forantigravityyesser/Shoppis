import { describe, expect, it } from 'vitest';
import { shouldNotifyCheckout } from './checkout-notify.js';

describe('shouldNotifyCheckout (docs/24 §2.7 D2)', () => {
  it('первый checkout → уведомления шлём', () => {
    expect(shouldNotifyCheckout({ idempotent: false })).toBe(true);
    expect(shouldNotifyCheckout({})).toBe(true);
    expect(shouldNotifyCheckout(null)).toBe(true);
  });

  it('идемпотентный ретрай → уведомления НЕ шлём (нет дубля)', () => {
    expect(shouldNotifyCheckout({ idempotent: true })).toBe(false);
  });
});

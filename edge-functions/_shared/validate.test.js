import { describe, expect, it } from 'vitest';
import {
  isUuid,
  isValidCursor,
  parseEnum,
  parseLimit,
  parsePositiveInt,
  validateOrderAction,
} from './validate.js';

const UUID = '11111111-2222-4333-8444-555555555555';

describe('isUuid', () => {
  it('принимает uuid, отвергает мусор', () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid('o1')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});

describe('parseEnum', () => {
  it('только из набора', () => {
    expect(parseEnum('buyer', ['buyer', 'seller'])).toBe('buyer');
    expect(parseEnum('admin', ['buyer', 'seller'])).toBeNull();
    expect(parseEnum(1, ['buyer'])).toBeNull();
  });
});

describe('parseLimit', () => {
  it('отсутствует → fallback', () => {
    expect(parseLimit(undefined)).toEqual({ ok: true, value: 20 });
    expect(parseLimit(null, { fallback: 5 })).toEqual({ ok: true, value: 5 });
  });

  it('числовая строка принимается, клампится в [min,max]', () => {
    expect(parseLimit('10')).toEqual({ ok: true, value: 10 });
    expect(parseLimit(999)).toEqual({ ok: true, value: 50 });
    expect(parseLimit(-3)).toEqual({ ok: true, value: 1 });
  });

  it('не число → ошибка', () => {
    expect(parseLimit('abc')).toEqual({ ok: false });
    expect(parseLimit(1.5)).toEqual({ ok: false });
  });
});

describe('isValidCursor', () => {
  it('пустой/null валиден (первая страница)', () => {
    expect(isValidCursor(null)).toBe(true);
    expect(isValidCursor('')).toBe(true);
  });

  it('строго <epoch>:<uuid>', () => {
    expect(isValidCursor(`1700000000000000:${UUID}`)).toBe(true);
    expect(isValidCursor('cursor-1')).toBe(false);
    expect(isValidCursor(`1700000000000000:`)).toBe(false);
    expect(isValidCursor({})).toBe(false);
  });
});

describe('parsePositiveInt', () => {
  it('только положительное целое в пределах', () => {
    expect(parsePositiveInt(2)).toBe(2);
    expect(parsePositiveInt('3', 99)).toBe(3);
    expect(parsePositiveInt(0)).toBeNull();
    expect(parsePositiveInt(100, 99)).toBeNull();
    expect(parsePositiveInt('x')).toBeNull();
  });
});

describe('validateOrderAction (docs/24 §2.7 D1)', () => {
  it('неизвестный action → UNKNOWN_ACTION', () => {
    expect(validateOrderAction({ action: 'nope' })).toEqual({ error: 'UNKNOWN_ACTION' });
    expect(validateOrderAction({})).toEqual({ error: 'UNKNOWN_ACTION' });
  });

  it('cancel: uuid + buyer|seller', () => {
    expect(validateOrderAction({ action: 'cancel', orderId: UUID, actorType: 'buyer' })).toEqual({
      action: 'cancel',
      actorType: 'buyer',
    });
    expect(validateOrderAction({ action: 'cancel', orderId: 'o1', actorType: 'buyer' })).toEqual({
      error: 'INVALID_ORDER_ID',
    });
    expect(validateOrderAction({ action: 'cancel', orderId: UUID, actorType: 'admin' })).toEqual({
      error: 'INVALID_ACTOR',
    });
    // actorType больше не схлопывается в seller по умолчанию.
    expect(validateOrderAction({ action: 'cancel', orderId: UUID })).toEqual({
      error: 'INVALID_ACTOR',
    });
  });

  it('transition: uuid + известный статус', () => {
    expect(validateOrderAction({ action: 'transition', orderId: UUID, toStatus: 'IN_TRANSIT' })).toEqual({
      action: 'transition',
    });
    expect(validateOrderAction({ action: 'transition', orderId: UUID })).toEqual({
      error: 'INVALID_TO_STATUS',
    });
  });

  it('delivery-outcome: uuid + RECEIVED|REFUSED', () => {
    expect(validateOrderAction({ action: 'delivery-outcome', orderId: UUID, outcome: 'RECEIVED' })).toEqual({
      action: 'delivery-outcome',
    });
    expect(validateOrderAction({ action: 'delivery-outcome', orderId: UUID, outcome: 'NOPE' })).toEqual({
      error: 'INVALID_OUTCOME',
    });
  });

  it('reconcile: uuid варианта + положительное количество', () => {
    expect(validateOrderAction({ action: 'reconcile', variantId: UUID, quantity: 2 })).toEqual({
      action: 'reconcile',
    });
    expect(validateOrderAction({ action: 'reconcile', variantId: 'v1', quantity: 2 })).toEqual({
      error: 'INVALID_VARIANT_ID',
    });
    expect(validateOrderAction({ action: 'reconcile', variantId: UUID, quantity: 0 })).toEqual({
      error: 'INVALID_QUANTITY',
    });
    expect(validateOrderAction({ action: 'reconcile', variantId: UUID, quantity: 1, orderId: 'x' })).toEqual({
      error: 'INVALID_ORDER_ID',
    });
  });
});

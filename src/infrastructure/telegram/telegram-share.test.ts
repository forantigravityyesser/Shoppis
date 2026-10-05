import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestWriteAccess } from '@telegram-apps/sdk';
import {
  MESSAGES_ACCESS_TIMEOUT_MS,
  requestMessagesAccess,
} from './telegram-share';

vi.mock('@telegram-apps/sdk', () => ({
  requestWriteAccess: vi.fn(),
  shareURL: vi.fn(),
}));

const mockRequestWriteAccess = vi.mocked(requestWriteAccess);
type WriteAccessReturn = ReturnType<typeof requestWriteAccess>;

const resolveWith = (status: string) =>
  Promise.resolve(status) as unknown as WriteAccessReturn;

describe('requestMessagesAccess', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRequestWriteAccess.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a long safety deadline for the native popup', () => {
    expect(MESSAGES_ACCESS_TIMEOUT_MS).toBe(60_000);
  });

  it('returns true when Telegram allows messages', async () => {
    mockRequestWriteAccess.mockReturnValue(resolveWith('allowed'));
    await expect(requestMessagesAccess()).resolves.toBe(true);
  });

  it('returns false when the user denies messages', async () => {
    mockRequestWriteAccess.mockReturnValue(resolveWith('cancelled'));
    await expect(requestMessagesAccess()).resolves.toBe(false);
  });

  it('returns false without hanging when Telegram never responds', async () => {
    mockRequestWriteAccess.mockReturnValue(
      new Promise<never>(() => {}) as unknown as WriteAccessReturn,
    );

    const promise = requestMessagesAccess();
    await vi.advanceTimersByTimeAsync(MESSAGES_ACCESS_TIMEOUT_MS);

    await expect(promise).resolves.toBe(false);
  });

  it('returns false when the request rejects', async () => {
    mockRequestWriteAccess.mockImplementation(
      () => Promise.reject(new Error('boom')) as unknown as WriteAccessReturn,
    );
    await expect(requestMessagesAccess()).resolves.toBe(false);
  });

  it('returns false when the request throws synchronously', async () => {
    mockRequestWriteAccess.mockImplementation(() => {
      throw new Error('unavailable');
    });
    await expect(requestMessagesAccess()).resolves.toBe(false);
  });
});

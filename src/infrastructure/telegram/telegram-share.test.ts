import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestWriteAccess } from '@telegram-apps/sdk';
import {
  MESSAGES_ACCESS_TIMEOUT_MS,
  requestMessagesAccess,
  sharePreparedMessage,
} from './telegram-share';

const { shareMessage } = vi.hoisted(() => ({ shareMessage: vi.fn() }));

vi.mock('@telegram-apps/sdk', () => ({
  requestWriteAccess: vi.fn(),
  shareURL: vi.fn(),
  shareMessage,
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

describe('sharePreparedMessage', () => {
  beforeEach(() => {
    shareMessage.mockReset();
    shareMessage.mockReturnValue(Promise.resolve());
    (shareMessage as unknown as { isAvailable: () => boolean }).isAvailable = vi.fn(() => true);
  });

  it('возвращает false для пустого id и не зовёт SDK', () => {
    expect(sharePreparedMessage('')).toBe(false);
    expect(shareMessage).not.toHaveBeenCalled();
  });

  it('открывает нативный диалог, когда метод доступен', () => {
    expect(sharePreparedMessage('mid-1')).toBe(true);
    expect(shareMessage).toHaveBeenCalledWith('mid-1');
  });

  it('возвращает false на старом клиенте (метод недоступен)', () => {
    (shareMessage as unknown as { isAvailable: () => boolean }).isAvailable = vi.fn(() => false);
    expect(sharePreparedMessage('mid-1')).toBe(false);
    expect(shareMessage).not.toHaveBeenCalled();
  });

  it('не бросает при недоступном окружении (isAvailable бросает)', () => {
    (shareMessage as unknown as { isAvailable: () => boolean }).isAvailable = vi.fn(() => {
      throw new Error('not in telegram');
    });
    expect(() => sharePreparedMessage('mid-1')).not.toThrow();
    expect(sharePreparedMessage('mid-1')).toBe(false);
  });
});

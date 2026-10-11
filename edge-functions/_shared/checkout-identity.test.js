import { describe, expect, it, vi } from 'vitest';
import { resolveCheckoutUsername } from './checkout-identity.js';

/** Minimal stub of the SDK chain `.from().select().eq().maybeSingle()`. */
function clientReturning(result) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { database: { from }, chain: { from, select, eq, maybeSingle } };
}

describe('resolveCheckoutUsername (ORD-02, server-resolved snapshot)', () => {
  it('возвращает username из telegram_identities по session.uid', async () => {
    const client = clientReturning({ data: { username: 'buyer_x' }, error: null });
    await expect(resolveCheckoutUsername(client, 'u1')).resolves.toBe('buyer_x');
    expect(client.chain.from).toHaveBeenCalledWith('telegram_identities');
    expect(client.chain.eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('identity без username → null (checkout не падает)', async () => {
    const client = clientReturning({ data: { username: null }, error: null });
    await expect(resolveCheckoutUsername(client, 'u1')).resolves.toBeNull();
  });

  it('пустая строка username → null', async () => {
    const client = clientReturning({ data: { username: '' }, error: null });
    await expect(resolveCheckoutUsername(client, 'u1')).resolves.toBeNull();
  });

  it('identity не найдена (data=null) → null', async () => {
    const client = clientReturning({ data: null, error: null });
    await expect(resolveCheckoutUsername(client, 'u1')).resolves.toBeNull();
  });

  it('ошибка запроса → null (не пробрасывает)', async () => {
    const client = clientReturning({ data: null, error: { message: 'boom' } });
    await expect(resolveCheckoutUsername(client, 'u1')).resolves.toBeNull();
  });

  it('исключение в SDK → null', async () => {
    const client = {
      database: {
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: vi.fn().mockRejectedValue(new Error('network')) }),
          }),
        }),
      },
    };
    await expect(resolveCheckoutUsername(client, 'u1')).resolves.toBeNull();
  });

  it('без userId → null и без запроса к БД', async () => {
    const client = clientReturning({ data: { username: 'x' }, error: null });
    await expect(resolveCheckoutUsername(client, null)).resolves.toBeNull();
    expect(client.chain.from).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeFunction } = vi.hoisted(() => ({ invokeFunction: vi.fn() }));
vi.mock('../insforge/functions-gateway', () => ({ invokeFunction }));

import { prepareShare } from './share-api';

beforeEach(() => invokeFunction.mockReset());

describe('share-api', () => {
  it('вызывает share-actions и возвращает id подготовленного сообщения', async () => {
    invokeFunction.mockResolvedValue({ data: { success: true, id: 'mid-1' }, error: null });

    await expect(prepareShare('tok', 'shop_abc', 'p1', 'https://x/img.jpg')).resolves.toBe('mid-1');

    expect(invokeFunction).toHaveBeenCalledWith('share-actions', {
      body: { publicId: 'shop_abc', productId: 'p1', photoUrl: 'https://x/img.jpg' },
      token: 'tok',
    });
  });

  it('бросает серверную ошибку без id', async () => {
    invokeFunction.mockResolvedValue({
      data: { success: false, error: 'INVALID_PHOTO' },
      error: null,
    });
    await expect(prepareShare('tok', 's', 'p', 'u')).rejects.toThrow('INVALID_PHOTO');
  });

  it('бросает ошибку транспорта', async () => {
    invokeFunction.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    await expect(prepareShare('tok', 's', 'p', 'u')).rejects.toThrow('Network error');
  });
});

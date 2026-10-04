import { describe, it, expect, vi, beforeEach } from 'vitest';

const { linkProduct, unlinkProduct } = vi.hoisted(() => ({
  linkProduct: vi.fn(),
  unlinkProduct: vi.fn(),
}));

vi.mock('../functions/catalog-api', () => ({
  linkProduct,
  unlinkProduct,
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  createVariant: vi.fn(),
  setStatus: vi.fn(),
  deleteProduct: vi.fn(),
}));

vi.mock('../insforge/client', () => ({ insforge: { database: {} } }));

import { linkProducts, unlinkProducts } from './product-repository';

beforeEach(() => {
  linkProduct.mockReset().mockResolvedValue(undefined);
  unlinkProduct.mockReset().mockResolvedValue(undefined);
});

describe('product-repository links', () => {
  it('с токеном делегирует в catalog-api', async () => {
    await linkProducts('p1', 'p2', 'tok');
    expect(linkProduct).toHaveBeenCalledWith('tok', 'p1', 'p2');

    await unlinkProducts('p1', 'p2', 'tok');
    expect(unlinkProduct).toHaveBeenCalledWith('tok', 'p1', 'p2');
  });

  it('self-link отклоняется до сети', async () => {
    await expect(linkProducts('p1', 'p1', null)).rejects.toThrow('SELF_LINK');
    expect(linkProduct).not.toHaveBeenCalled();
  });
});

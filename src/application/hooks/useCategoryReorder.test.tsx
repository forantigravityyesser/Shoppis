// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const { reorderCategory } = vi.hoisted(() => ({ reorderCategory: vi.fn() }));

vi.mock('./useInventoryActions', () => ({
  useInventoryActions: () => ({ reorderCategory }),
}));

import { useCategoryReorder } from './useCategoryReorder';

beforeEach(() => {
  reorderCategory.mockReset();
});

describe('useCategoryReorder', () => {
  it('успех: true, pending гаснет, ошибки нет', async () => {
    reorderCategory.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategoryReorder());

    let ok = false;
    await act(async () => {
      ok = await result.current.reorder('c1', 2);
    });

    expect(ok).toBe(true);
    expect(reorderCategory).toHaveBeenCalledWith('c1', 2);
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('ошибка: false и понятное сообщение', async () => {
    reorderCategory.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCategoryReorder());

    let ok = true;
    await act(async () => {
      ok = await result.current.reorder('c1', 2);
    });

    expect(ok).toBe(false);
    expect(result.current.error).toMatch(/Не удалось изменить порядок/);
  });

  it('защита от дублей: повторный вызов во время отправки игнорируется', async () => {
    let resolve!: () => void;
    reorderCategory.mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolve = res;
        }),
    );
    const { result } = renderHook(() => useCategoryReorder());

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.reorder('c1', 2);
      second = result.current.reorder('c1', 3);
    });

    await expect(second).resolves.toBe(false);
    expect(reorderCategory).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve();
      await first;
    });
    expect(result.current.pending).toBe(false);
  });

  it('reset сбрасывает ошибку', async () => {
    reorderCategory.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCategoryReorder());

    await act(async () => {
      await result.current.reorder('c1', 2);
    });
    expect(result.current.error).not.toBeNull();

    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });
});

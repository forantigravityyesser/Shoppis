// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ReorderCategorySheet from './ReorderCategorySheet';

function renderSheet(overrides: Partial<ComponentProps<typeof ReorderCategorySheet>> = {}) {
  const props = {
    open: true,
    categoryName: 'Обувь',
    total: 6,
    currentPosition: 2,
    onClose: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
  render(<ReorderCategorySheet {...props} />);
  return props;
}

describe('ReorderCategorySheet', () => {
  it('рендерит числа 1..N, текущая позиция активна', () => {
    renderSheet({ total: 6, currentPosition: 2 });

    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByRole('button', { name: String(n) })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: '7' })).toBeNull();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('клик по числу вызывает onSelect с позицией (сразу)', async () => {
    const props = renderSheet({ onSelect: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(props.onSelect).toHaveBeenCalledWith(5);
  });

  it('числа 1–4 получают акцентный цвет, 5+ — нет', () => {
    renderSheet({ total: 6 });
    expect(screen.getByRole('button', { name: '3' }).className).toContain('reorder__num--3');
    expect(screen.getByRole('button', { name: '6' }).className).not.toContain('reorder__num--6');
  });
});

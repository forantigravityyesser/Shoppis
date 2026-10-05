// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import InventoryModeSwitcher from './InventoryModeSwitcher';

describe('InventoryModeSwitcher', () => {
  it('показывает обе секции и отмечает активную', () => {
    render(<InventoryModeSwitcher mode="products" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Товары' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Категории' })).toHaveAttribute('aria-selected', 'false');
  });

  it('клик переключает режим', async () => {
    const onChange = vi.fn();
    render(<InventoryModeSwitcher mode="products" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Категории' }));
    expect(onChange).toHaveBeenCalledWith('categories');
  });
});

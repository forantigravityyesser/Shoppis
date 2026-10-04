// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StarInput from './StarInput';

describe('StarInput', () => {
  it('клик по звезде вызывает onChange с её номером', async () => {
    const onChange = vi.fn();
    render(<StarInput value={0} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '4 из 5' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('отражает выбранное значение через aria-pressed', () => {
    render(<StarInput value={3} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '3 из 5' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '4 из 5' })).toHaveAttribute('aria-pressed', 'false');
  });
});

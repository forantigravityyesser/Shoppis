// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from './SearchBar';

describe('SearchBar', () => {
  it('показывает значение и пробрасывает ввод', async () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Поиск по названию'), 'nike');
    expect(onChange).toHaveBeenCalled();
  });

  it('clear-кнопка сбрасывает значение', async () => {
    const onChange = vi.fn();
    render(<SearchBar value="nike" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Очистить' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('без значения нет clear-кнопки', () => {
    render(<SearchBar value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Очистить' })).toBeNull();
  });
});

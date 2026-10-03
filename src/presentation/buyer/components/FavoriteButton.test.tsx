// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useFavorites } = vi.hoisted(() => ({ useFavorites: vi.fn() }));
vi.mock('../../../application/hooks/useFavorites', () => ({ useFavorites }));

import FavoriteButton from './FavoriteButton';

beforeEach(() => useFavorites.mockReset());

describe('FavoriteButton', () => {
  it('не активен: aria-pressed=false, клик вызывает toggleFavorite', async () => {
    const toggleFavorite = vi.fn();
    useFavorites.mockReturnValue({ isFavorite: () => false, toggleFavorite });

    render(<FavoriteButton productId="p1" />);
    const button = screen.getByRole('button', { name: 'В избранное' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(button);
    expect(toggleFavorite).toHaveBeenCalledWith('p1');
  });

  it('активен: aria-pressed=true и подпись «Убрать из избранного»', () => {
    useFavorites.mockReturnValue({ isFavorite: () => true, toggleFavorite: vi.fn() });
    render(<FavoriteButton productId="p1" />);
    expect(screen.getByRole('button', { name: 'Убрать из избранного' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('клик не всплывает к родителю (карточка не открывается)', async () => {
    const onParent = vi.fn();
    useFavorites.mockReturnValue({ isFavorite: () => false, toggleFavorite: vi.fn() });

    render(
      <div onClick={onParent}>
        <FavoriteButton productId="p1" />
      </div>,
    );

    await userEvent.click(screen.getByRole('button'));
    expect(onParent).not.toHaveBeenCalled();
  });
});

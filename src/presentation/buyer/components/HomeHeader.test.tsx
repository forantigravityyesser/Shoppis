// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomeHeader from './HomeHeader';

function setup(overrides: Partial<Parameters<typeof HomeHeader>[0]> = {}) {
  const onSearch = vi.fn();
  const onProfile = vi.fn();
  const result = render(
    <HomeHeader
      storeName="Nike Shop"
      sellerAvatarUrl={null}
      onSearch={onSearch}
      onProfile={onProfile}
      {...overrides}
    />,
  );
  return { onSearch, onProfile, ...result };
}

describe('HomeHeader', () => {
  it('показывает название магазина и вызывает поиск/профиль', async () => {
    const { onSearch, onProfile } = setup();

    expect(screen.getByRole('heading', { name: 'Nike Shop' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Поиск' }));
    await userEvent.click(screen.getByRole('button', { name: 'Профиль' }));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onProfile).toHaveBeenCalledTimes(1);
  });

  it('показывает фото продавца, когда оно есть', () => {
    const { container } = setup({ sellerAvatarUrl: 'https://cdn/avatar.jpg' });
    const img = container.querySelector('.home-avatar__img');
    expect(img).toHaveAttribute('src', 'https://cdn/avatar.jpg');
  });

  it('fallback: первая буква, когда фото нет', () => {
    setup({ storeName: 'nike shop', sellerAvatarUrl: null });
    expect(screen.getByText('N')).toBeInTheDocument();
  });

  it('нет уведомлений: только две кнопки в шапке', () => {
    setup();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});

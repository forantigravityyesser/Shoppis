// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomeHeader from './HomeHeader';

function setup(overrides: Partial<Parameters<typeof HomeHeader>[0]> = {}) {
  const onSearch = vi.fn();
  const onProfile = vi.fn();
  const onToggleDescription = vi.fn();
  const result = render(
    <HomeHeader
      storeName="Nike Shop"
      storeDescription={null}
      descriptionOpen={false}
      buyerAvatarUrl={null}
      buyerName="Александр"
      onSearch={onSearch}
      onProfile={onProfile}
      onToggleDescription={onToggleDescription}
      {...overrides}
    />,
  );
  return { onSearch, onProfile, onToggleDescription, ...result };
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

  it('показывает фото покупателя, когда оно есть', () => {
    const { container } = setup({ buyerAvatarUrl: 'https://cdn/buyer.jpg' });
    const img = container.querySelector('.home-avatar__img');
    expect(img).toHaveAttribute('src', 'https://cdn/buyer.jpg');
  });

  it('fallback: первая буква имени покупателя, когда фото нет', () => {
    setup({ buyerName: 'мария', buyerAvatarUrl: null });
    expect(screen.getByText('М')).toBeInTheDocument();
  });

  it('битый аватар → fallback-инициал покупателя', () => {
    const { container } = setup({ buyerName: 'Александр', buyerAvatarUrl: 'https://cdn/broken.jpg' });
    const img = container.querySelector('.home-avatar__img');
    expect(img).toBeTruthy();
    fireEvent.error(img as Element);
    expect(container.querySelector('.home-avatar__img')).toBeNull();
    expect(screen.getByText('А')).toBeInTheDocument();
  });

  it('пустое имя покупателя → «?»', () => {
    setup({ buyerName: '', buyerAvatarUrl: null });
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('Unicode-имя → первая графема без разрезания', () => {
    setup({ buyerName: '🎉 party', buyerAvatarUrl: null });
    expect(screen.getByText('🎉')).toBeInTheDocument();
  });

  it('нет уведомлений: только поиск и профиль, когда описания нет', () => {
    setup();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('с описанием: кнопка описания вызывает toggle и ставит aria-expanded', async () => {
    const { onToggleDescription } = setup({
      storeDescription: 'О нас',
      descriptionOpen: true,
    });

    const button = screen.getByRole('button', { name: 'Описание магазина' });
    expect(button).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(button);
    expect(onToggleDescription).toHaveBeenCalledTimes(1);
  });

  it('пустое/пробельное описание → кнопки описания нет', () => {
    setup({ storeDescription: '   ' });
    expect(screen.queryByRole('button', { name: 'Описание магазина' })).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StorefrontView from './StorefrontView';
import type { Store } from '../../../domain/models/store';

function makeStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 's1',
    ownerUserId: 'u1',
    ownerTelegramId: 'tg1',
    name: 'Nike Shop',
    description: 'Обувь и одежда',
    logoUrl: '',
    bannerUrl: '',
    supportHandle: '',
    currencyCode: 'USD',
    currencySymbol: '$',
    language: 'ru',
    status: 'ACTIVE',
    publicId: 'pub1',
    createdAt: '2026-09-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('StorefrontView', () => {
  it('показывает загрузку', () => {
    render(<StorefrontView store={null} loading />);
    expect(screen.getByText('Загрузка магазина…')).toBeInTheDocument();
  });

  it('показывает, что магазин не найден', () => {
    render(<StorefrontView store={null} loading={false} />);
    expect(screen.getByText('Магазин не найден')).toBeInTheDocument();
  });

  it('ACTIVE показывает витрину с названием и описанием', () => {
    render(<StorefrontView store={makeStore()} loading={false} />);
    expect(screen.getByRole('heading', { name: 'Nike Shop' })).toBeInTheDocument();
    expect(screen.getByText('Обувь и одежда')).toBeInTheDocument();
    expect(screen.queryByText('Магазин временно закрыт')).toBeNull();
  });

  it('показывает кнопку связи при наличии контакта', () => {
    render(<StorefrontView store={makeStore({ supportHandle: 'john' })} loading={false} />);
    const link = screen.getByRole('link', { name: 'Связаться с продавцом' });
    expect(link).toHaveAttribute('href', 'https://t.me/john');
  });

  it('PAUSED показывает экран паузы и не показывает каталог', () => {
    render(<StorefrontView store={makeStore({ status: 'PAUSED' })} loading={false} />);
    expect(screen.getByText('Магазин временно закрыт')).toBeInTheDocument();
    expect(screen.queryByText(/Каталог товаров/)).toBeNull();
    expect(screen.queryByText('Nike Shop')).toBeNull();
  });

  it('PAUSED сохраняет возможность связи, если контакт задан', () => {
    render(
      <StorefrontView store={makeStore({ status: 'PAUSED', supportHandle: 'john' })} loading={false} />,
    );
    expect(screen.getByRole('link', { name: 'Связаться с продавцом' })).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StoreStatusView from './StoreStatusView';

describe('StoreStatusView', () => {
  it('notFound показывает «Магазин не найден»', () => {
    render(<StoreStatusView variant="notFound" />);
    expect(screen.getByText('Магазин не найден')).toBeInTheDocument();
  });

  it('paused показывает экран закрытого магазина', () => {
    render(<StoreStatusView variant="paused" />);
    expect(screen.getByText('Магазин временно закрыт')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Связаться с продавцом' })).toBeNull();
  });

  it('paused с контактом показывает ссылку в Telegram', () => {
    render(<StoreStatusView variant="paused" supportHandle="john" />);
    expect(screen.getByRole('link', { name: 'Связаться с продавцом' })).toHaveAttribute(
      'href',
      'https://t.me/john',
    );
  });

  it('notFound не показывает контакт даже при handle', () => {
    render(<StoreStatusView variant="notFound" supportHandle="john" />);
    expect(screen.queryByRole('link', { name: 'Связаться с продавцом' })).toBeNull();
  });

  it('paused с брендом: имя магазина + fallback-инициал', () => {
    render(<StoreStatusView variant="paused" storeName="nike" />);
    expect(screen.getByText('nike')).toBeInTheDocument();
    expect(screen.getByText('N')).toBeInTheDocument();
  });

  it('paused с аватаром: показывает изображение', () => {
    const { container } = render(
      <StoreStatusView variant="paused" storeName="Nike" sellerAvatarUrl="https://cdn/a.jpg" />,
    );
    expect(container.querySelector('.store-status__avatar')).toHaveAttribute(
      'src',
      'https://cdn/a.jpg',
    );
  });

  it('notFound не показывает бренд даже с storeName', () => {
    render(<StoreStatusView variant="notFound" storeName="Nike" />);
    expect(screen.queryByText('Nike')).toBeNull();
  });
});

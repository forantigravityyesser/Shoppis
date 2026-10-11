// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ openLink: vi.fn(() => true) }));

vi.mock('../../../application/hooks/useOpenTelegramLink', () => ({
  useOpenTelegramLink: () => h.openLink,
}));

import OrderContactButton from './OrderContactButton';

beforeEach(() => {
  h.openLink.mockReset();
  h.openLink.mockReturnValue(true);
});

describe('OrderContactButton', () => {
  it('валидный username → кнопка, открывает t.me-ссылку', () => {
    render(<OrderContactButton username="Dnk_65" />);
    fireEvent.click(screen.getByTestId('order-contact-btn'));
    expect(h.openLink).toHaveBeenCalledWith('https://t.me/Dnk_65');
  });

  it('username с @ / ссылкой нормализуется', () => {
    render(<OrderContactButton username="@buyer_x" />);
    fireEvent.click(screen.getByTestId('order-contact-btn'));
    expect(h.openLink).toHaveBeenCalledWith('https://t.me/buyer_x');
  });

  it('сбой открытия → inline error', () => {
    h.openLink.mockReturnValue(false);
    render(<OrderContactButton username="seller" />);
    fireEvent.click(screen.getByTestId('order-contact-btn'));
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось открыть контакт.');
  });

  it('null / некорректный username → fallback-текст, без кнопки', () => {
    render(<OrderContactButton username={null} fallbackText="Продавец не указал контакт." />);
    expect(screen.queryByTestId('order-contact-btn')).toBeNull();
    expect(screen.getByTestId('order-contact-fallback')).toHaveTextContent(
      'Продавец не указал контакт.',
    );
  });

  it('произвольный fallback-node (например, телефон)', () => {
    render(
      <OrderContactButton username={null} fallback={<span>+375257914112</span>} />,
    );
    expect(screen.getByText('+375257914112')).toBeInTheDocument();
  });
});

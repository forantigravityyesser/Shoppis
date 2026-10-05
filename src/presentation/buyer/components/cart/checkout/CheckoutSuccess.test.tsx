// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutSuccess from './CheckoutSuccess';
import type { CheckoutResult } from '../../../../../application/contracts/checkout';

const ORDER: CheckoutResult = {
  orderId: 'o1',
  orderNumber: 'SH-251005-ABC',
  totalMinor: 244500,
  currencyCode: 'RUB',
};

describe('CheckoutSuccess', () => {
  it('показывает успех, номер и сумму; уведомление отправлено', () => {
    render(
      <CheckoutSuccess order={ORDER} notificationsGranted currencySymbol="₽" onClose={vi.fn()} />,
    );
    expect(screen.getByText('Заказ принят!')).toBeInTheDocument();
    expect(screen.getByText('SH-251005-ABC')).toBeInTheDocument();
    expect(screen.getByText('2445 ₽')).toBeInTheDocument();
    expect(screen.getByText(/отправили уведомление в Telegram/)).toBeInTheDocument();
  });

  it('без разрешения — честное сообщение об отключённых уведомлениях', () => {
    render(
      <CheckoutSuccess
        order={ORDER}
        notificationsGranted={false}
        currencySymbol="₽"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Уведомления в Telegram отключены/)).toBeInTheDocument();
  });

  it('возврат в магазин по кнопке', async () => {
    const onClose = vi.fn();
    render(
      <CheckoutSuccess order={ORDER} notificationsGranted currencySymbol="₽" onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Вернуться в магазин' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

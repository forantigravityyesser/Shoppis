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

function renderSuccess(overrides: {
  notificationsGranted?: boolean;
  notificationsPending?: boolean;
  onClose?: () => void;
  onDismiss?: () => void;
  onEnableNotifications?: () => void;
  autoClose?: boolean;
  autoCloseMs?: number;
} = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onDismiss = overrides.onDismiss ?? vi.fn();
  const onEnableNotifications = overrides.onEnableNotifications ?? vi.fn();
  render(
    <CheckoutSuccess
      order={ORDER}
      notificationsGranted={overrides.notificationsGranted ?? true}
      notificationsPending={overrides.notificationsPending ?? false}
      currencySymbol="₽"
      onClose={onClose}
      onDismiss={onDismiss}
      onEnableNotifications={onEnableNotifications}
      autoClose={overrides.autoClose}
      autoCloseMs={overrides.autoCloseMs}
    />,
  );
  return { onClose, onDismiss, onEnableNotifications };
}

describe('CheckoutSuccess', () => {
  it('показывает успех, номер и сумму; уведомления включены', () => {
    renderSuccess({ notificationsGranted: true });
    expect(screen.getByText('Заказ принят!')).toBeInTheDocument();
    expect(screen.getByText('SH-251005-ABC')).toBeInTheDocument();
    expect(screen.getByText('2445 ₽')).toBeInTheDocument();
    expect(screen.getByTestId('checkout-notify-on')).toBeInTheDocument();
  });

  it('без согласия — показывает opt-in, кнопка запрашивает разрешение', async () => {
    const { onEnableNotifications } = renderSuccess({ notificationsGranted: false });
    const allow = screen.getByRole('button', { name: 'Разрешить уведомления' });
    expect(allow).toBeEnabled();
    await userEvent.click(allow);
    expect(onEnableNotifications).toHaveBeenCalledTimes(1);
  });

  it('во время запроса кнопка блокируется и показывает состояние', () => {
    renderSuccess({ notificationsGranted: false, notificationsPending: true });
    expect(screen.getByRole('button', { name: 'Запрашиваем…' })).toBeDisabled();
  });

  it('кнопка «Перейти к заказам» вызывает onClose', async () => {
    const { onClose } = renderSuccess({ notificationsGranted: true });
    await userEvent.click(screen.getByRole('button', { name: 'Перейти к заказам' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('скрывается сам через autoCloseMs (без перехода)', () => {
    vi.useFakeTimers();
    try {
      const { onDismiss, onClose } = renderSuccess({
        notificationsGranted: true,
        autoClose: true,
        autoCloseMs: 5000,
      });
      expect(onDismiss).not.toHaveBeenCalled();
      vi.advanceTimersByTime(4999);
      expect(onDismiss).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('autoClose=false не скрывает окно (ждём opt-in)', () => {
    vi.useFakeTimers();
    try {
      const { onDismiss } = renderSuccess({ notificationsGranted: false, autoClose: false });
      vi.advanceTimersByTime(10_000);
      expect(onDismiss).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderConfirm from './OrderConfirm';

describe('OrderConfirm', () => {
  it('рендерит текст и подписи, вызывает onCancel/onConfirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <OrderConfirm text="Отменить заказ?" confirmLabel="Отменить" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    expect(screen.getByText('Отменить заказ?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('pending блокирует повторный submit (обе кнопки disabled)', () => {
    render(<OrderConfirm text="x" pending onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeDisabled();
  });

  it('показывает ошибку', () => {
    render(
      <OrderConfirm text="x" error="Этот заказ уже нельзя отменить." onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Этот заказ уже нельзя отменить.');
  });
});

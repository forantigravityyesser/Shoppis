// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CheckoutFormSheet from './CheckoutFormSheet';
import type { RecipientInfo } from '../../../../../domain/models/customer';
import type { CheckoutRecipientValidation } from '../../../../../domain/rules/checkout-rules';
import type { CheckoutStatus } from '../../../../../application/hooks/useCheckout';

const RECIPIENT: RecipientInfo = {
  name: 'Иван Петров',
  phone: '+79001234567',
  address: 'Москва, ул. Ленина 1',
};

const VALID: CheckoutRecipientValidation = {
  nameValid: true,
  phoneValid: true,
  addressValid: true,
  valid: true,
};

const INVALID: CheckoutRecipientValidation = {
  nameValid: false,
  phoneValid: false,
  addressValid: false,
  valid: false,
};

function props(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    recipient: RECIPIENT,
    validation: VALID,
    status: 'idle' as CheckoutStatus,
    error: null as string | null,
    supportHandle: 'john',
    storeName: 'Nike',
    onFieldChange: vi.fn(),
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('CheckoutFormSheet', () => {
  it('рендерит поля, телефон — с цифровой клавиатурой', () => {
    render(<CheckoutFormSheet {...props()} />);
    expect(screen.getByLabelText('ФИО')).toHaveValue('Иван Петров');
    const phone = screen.getByLabelText('Телефон');
    expect(phone).toHaveAttribute('type', 'tel');
    expect(phone).toHaveAttribute('inputmode', 'tel');
    expect(screen.getByLabelText('Адрес доставки')).toHaveValue('Москва, ул. Ленина 1');
  });

  it('кнопка «Оформить заказ» активна только при валидности', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<CheckoutFormSheet {...props({ validation: INVALID, onSubmit })} />);
    expect(screen.getByRole('button', { name: 'Оформить заказ' })).toBeDisabled();

    rerender(<CheckoutFormSheet {...props({ onSubmit })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Оформить заказ' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('изменение полей пробрасывается наружу', () => {
    const onFieldChange = vi.fn();
    render(<CheckoutFormSheet {...props({ onFieldChange })} />);
    fireEvent.change(screen.getByLabelText('ФИО'), { target: { value: 'Анна' } });
    expect(onFieldChange).toHaveBeenCalledWith({ name: 'Анна' });
    fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '+7900' } });
    expect(onFieldChange).toHaveBeenCalledWith({ phone: '+7900' });
  });

  it('ошибка поля появляется после blur', () => {
    render(<CheckoutFormSheet {...props({ recipient: { name: '', phone: '', address: '' }, validation: INVALID })} />);
    expect(screen.queryByText('Укажите имя и фамилию')).not.toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText('ФИО'));
    expect(screen.getByText('Укажите имя и фамилию')).toBeInTheDocument();
  });

  it('общая ошибка оформления и состояние отправки', () => {
    const { rerender } = render(<CheckoutFormSheet {...props({ error: 'Недостаточно товара.' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Недостаточно товара.');

    rerender(<CheckoutFormSheet {...props({ status: 'submitting' })} />);
    const submit = screen.getByRole('button', { name: /Оформляем/ });
    expect(submit).toBeDisabled();
  });

  it('закрытие по кнопке', async () => {
    const onClose = vi.fn();
    render(<CheckoutFormSheet {...props({ onClose })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

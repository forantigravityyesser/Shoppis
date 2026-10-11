// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderRefusalPicker from './OrderRefusalPicker';

describe('OrderRefusalPicker (ORD-10)', () => {
  it('рендерит пять контролируемых причин, confirm заблокирован до выбора', () => {
    render(<OrderRefusalPicker onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Подтвердить отказ' })).toBeDisabled();
  });

  it('выбор причины + подтверждение → onConfirm с кодом', () => {
    const onConfirm = vi.fn();
    render(<OrderRefusalPicker onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Другое' }));
    const confirm = screen.getByRole('button', { name: 'Подтвердить отказ' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('OTHER');
  });

  it('pending блокирует выбор и подтверждение', () => {
    render(<OrderRefusalPicker pending onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Подтвердить отказ' })).toBeDisabled();
    expect(screen.getAllByRole('radio')[0]).toBeDisabled();
  });

  it('«Отмена» и ошибка', () => {
    const onCancel = vi.fn();
    render(<OrderRefusalPicker error="Укажите причину." onConfirm={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Укажите причину.');
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

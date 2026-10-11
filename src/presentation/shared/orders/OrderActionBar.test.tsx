// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderActionBar from './OrderActionBar';

describe('OrderActionBar', () => {
  it('рендерит конфигурируемые действия и вызывает onClick', () => {
    const onPrimary = vi.fn();
    const onCancel = vi.fn();
    render(
      <OrderActionBar
        actions={[
          { key: 'transit', label: 'Передать в доставку', onClick: onPrimary, variant: 'primary' },
          { key: 'cancel', label: 'Отменить', onClick: onCancel, variant: 'danger' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Передать в доставку' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disabled-действие не кликается', () => {
    const onClick = vi.fn();
    render(
      <OrderActionBar
        actions={[{ key: 'x', label: 'Ждать', onClick, disabled: true }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ждать' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('пустой список → ничего не рендерит', () => {
    const { container } = render(<OrderActionBar actions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

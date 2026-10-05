// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartItemCard from './CartItemCard';
import type { BuyerCartItem, CartItemView } from '../../../../application/read-models/cart';

const ITEM: BuyerCartItem = {
  productId: 'p1',
  productVariantId: 'v1',
  quantity: 2,
  price: 1000,
  selected: true,
};

const VIEW: CartItemView = {
  productId: 'p1',
  productVariantId: 'v1',
  title: 'Nike Air Max',
  imageUrl: null,
  variantName: 'Размер',
  variantValue: '42',
  unitPrice: 12000,
  currencySymbol: '$',
  availableQuantity: 5,
  productAvailable: true,
  variantAvailable: true,
};

function props(overrides: Record<string, unknown> = {}) {
  return {
    item: ITEM,
    view: VIEW,
    orderable: true,
    confirming: false,
    onToggleSelected: vi.fn(),
    onQuantityChange: vi.fn(),
    onFixQuantity: vi.fn(),
    onRequestRemove: vi.fn(),
    onCancelRemove: vi.fn(),
    onConfirmRemove: vi.fn(),
    onOpenProduct: vi.fn(),
    ...overrides,
  };
}

describe('CartItemCard', () => {
  it('рендерит название, вариант и цену', () => {
    render(<CartItemCard {...props()} />);
    expect(screen.getByText('Nike Air Max')).toBeInTheDocument();
    expect(screen.getByText('Размер: 42')).toBeInTheDocument();
    expect(screen.getByText('120 $')).toBeInTheDocument();
  });

  it('selection: aria-checked и переключение', async () => {
    const onToggleSelected = vi.fn();
    render(<CartItemCard {...props({ onToggleSelected })} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Убрать из оформления' });
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(checkbox);
    expect(onToggleSelected).toHaveBeenCalledTimes(1);
  });

  it('навигация в товар — только фото и название', async () => {
    const onOpenProduct = vi.fn();
    render(<CartItemCard {...props({ onOpenProduct })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Nike Air Max' }));
    expect(onOpenProduct).toHaveBeenCalledTimes(1);
  });

  it('недостаточный сток помечается, количество меняется', async () => {
    const onQuantityChange = vi.fn();
    render(<CartItemCard {...props({ orderable: false, onQuantityChange })} />);

    expect(screen.getByText('Доступно только 5 шт.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Увеличить количество' }));
    expect(onQuantityChange).toHaveBeenCalledWith(3);
  });

  it('недостаточный сток: «Уменьшить до N» вызывает onFixQuantity', async () => {
    const onFixQuantity = vi.fn();
    render(
      <CartItemCard
        {...props({
          orderable: false,
          view: { ...VIEW, availableQuantity: 3 },
          onFixQuantity,
        })}
      />,
    );

    expect(screen.getByText('Доступно только 3 шт.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Уменьшить до 3' }));
    expect(onFixQuantity).toHaveBeenCalledTimes(1);
  });

  it('нет в наличии: количество недоступно, без кнопки уменьшения', () => {
    render(
      <CartItemCard
        {...props({ orderable: false, view: { ...VIEW, availableQuantity: 0 } })}
      />,
    );

    expect(screen.getByText('Нет в наличии')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Уменьшить до/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Увеличить количество' })).toBeDisabled();
  });

  it('удаление: открыть подтверждение → Да/Нет', async () => {
    const onRequestRemove = vi.fn();
    const onConfirmRemove = vi.fn();
    const onCancelRemove = vi.fn();
    const { rerender } = render(
      <CartItemCard {...props({ onRequestRemove, onConfirmRemove, onCancelRemove })} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Удалить «Nike Air Max» из корзины' }));
    expect(onRequestRemove).toHaveBeenCalledTimes(1);

    rerender(<CartItemCard {...props({ confirming: true, onConfirmRemove, onCancelRemove })} />);
    expect(screen.getByText('Удалить товар из корзины?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Да' }));
    expect(onConfirmRemove).toHaveBeenCalledTimes(1);

    rerender(<CartItemCard {...props({ confirming: true, onConfirmRemove, onCancelRemove })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Нет' }));
    expect(onCancelRemove).toHaveBeenCalledTimes(1);
  });
});

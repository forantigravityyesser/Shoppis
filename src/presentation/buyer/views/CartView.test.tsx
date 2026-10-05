// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';

const { useBuyerCart, useCheckout, state } = vi.hoisted(() => ({
  useBuyerCart: vi.fn(),
  useCheckout: vi.fn(),
  state: {
    viewedStore: { publicId: 'pub1', name: 'Shop', supportHandle: 'john' } as null | {
      publicId: string;
      name?: string;
      supportHandle?: string | null;
    },
    serverUser: null as null | { photoUrl: string; firstName: string },
  },
}));

vi.mock('../../../application/hooks/useBuyerCart', () => ({ useBuyerCart }));
vi.mock('../../../application/hooks/useCheckout', () => ({ useCheckout }));
vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn() }),
}));
vi.mock('../../../application/store', () => ({
  useStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

import CartView from './CartView';
import type { BuyerCartState } from '../../../application/hooks/useBuyerCart';
import type { CheckoutState } from '../../../application/hooks/useCheckout';
import type { ReconciledCartItem } from '../../../application/services/cart-reconciliation';
import type { CartItemView } from '../../../application/read-models/cart';
import type { StorefrontStore } from '../../../application/read-models/storefront';

const STORE: StorefrontStore = {
  id: 's1',
  publicId: 'pub1',
  name: 'Shop',
  bannerUrl: null,
  status: 'ACTIVE',
  currencyCode: 'USD',
  currencySymbol: '$',
};

function view(overrides: Partial<CartItemView> = {}): CartItemView {
  return {
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
    ...overrides,
  };
}

function entry(
  opts: {
    productId?: string;
    variantId?: string;
    quantity?: number;
    selected?: boolean;
    unitPrice?: number;
    orderable?: boolean;
    title?: string;
    availableQuantity?: number;
  } = {},
): ReconciledCartItem {
  const productId = opts.productId ?? 'p1';
  const variantId = opts.variantId ?? 'v1';
  return {
    item: {
      productId,
      productVariantId: variantId,
      quantity: opts.quantity ?? 2,
      price: 1000,
      selected: opts.selected ?? true,
    },
    view: view({
      productId,
      productVariantId: variantId,
      title: opts.title ?? 'Nike Air Max',
      unitPrice: opts.unitPrice ?? 12000,
      availableQuantity: opts.availableQuantity ?? 5,
    }),
    orderable: opts.orderable ?? true,
  };
}

function cartState(overrides: Partial<BuyerCartState> = {}): BuyerCartState {
  return {
    items: [],
    store: STORE,
    loading: false,
    reconciling: false,
    error: null,
    removedKeys: [],
    storePaused: false,
    hasUnavailable: false,
    hasUnavailableSelected: false,
    isEmpty: false,
    hasSelection: true,
    selectionState: 'all',
    canCheckout: true,
    setAllSelected: vi.fn(),
    setSelectedByKeys: vi.fn(),
    toggleSelected: vi.fn(),
    updateQty: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  };
}

function checkoutState(overrides: Partial<CheckoutState> = {}): CheckoutState {
  return {
    recipient: { name: 'Иван', phone: '+79001234567', address: 'Москва, ул. Ленина 1' },
    validation: { nameValid: true, phoneValid: true, addressValid: true, valid: true },
    status: 'idle',
    error: null,
    lastOrder: null,
    notificationsGranted: false,
    notificationsPending: false,
    setField: vi.fn(),
    submit: vi.fn(),
    enableNotifications: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

function renderCart() {
  return render(
    <MemoryRouter>
      <CartView />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useBuyerCart.mockReset();
  useCheckout.mockReset();
  useCheckout.mockReturnValue(checkoutState());
  state.viewedStore = { publicId: 'pub1', name: 'Shop', supportHandle: 'john' };
  state.serverUser = null;
});

describe('CartView', () => {
  it('loading → skeleton', () => {
    useBuyerCart.mockReturnValue(cartState({ loading: true }));
    renderCart();
    expect(screen.getByTestId('cart-skeleton')).toBeInTheDocument();
  });

  it('ошибка → экран ошибки с повтором', async () => {
    const refresh = vi.fn();
    useBuyerCart.mockReturnValue(cartState({ error: 'boom', refresh }));
    renderCart();

    expect(screen.getByText('Не удалось загрузить корзину')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('пустая корзина → сообщение и переход в каталог', () => {
    useBuyerCart.mockReturnValue(cartState({ isEmpty: true }));
    renderCart();
    expect(screen.getByText('Корзина пуста')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Перейти в каталог' })).toBeInTheDocument();
  });

  it('список: позиции, итог выбранных и активный CTA', async () => {
    useBuyerCart.mockReturnValue(
      cartState({
        isEmpty: false,
        items: [
          entry({ productId: 'p1', variantId: 'v1', unitPrice: 12000, quantity: 2, title: 'Первый' }),
          entry({ productId: 'p2', variantId: 'v2', unitPrice: 5000, quantity: 1, title: 'Второй' }),
        ],
      }),
    );
    renderCart();

    expect(screen.getByText('Первый')).toBeInTheDocument();
    expect(screen.getByText('Второй')).toBeInTheDocument();

    // Итог вынесен в CTA (отдельного блока «Итого» больше нет).
    const cta = screen.getByRole('button', { name: /Оформить заказ · 290 \$/ });
    expect(cta).toBeEnabled();
    // Клик по CTA открывает форму оформления (CART-05c).
    expect(screen.queryByTestId('checkout-form')).not.toBeInTheDocument();
    await userEvent.click(cta);
    expect(screen.getByTestId('checkout-form')).toBeInTheDocument();
  });

  it('успех → оверлей поверх, переход к заказам сбрасывает checkout', async () => {
    const reset = vi.fn();
    useCheckout.mockReturnValue(
      checkoutState({
        status: 'success',
        notificationsGranted: true,
        lastOrder: { orderId: 'o1', orderNumber: 'SH-1', totalMinor: 24000, currencyCode: 'USD' },
        reset,
      }),
    );
    useBuyerCart.mockReturnValue(cartState({ isEmpty: false, items: [entry()] }));
    render(
      <MemoryRouter initialEntries={['/cart']}>
        <Routes>
          <Route path="/cart" element={<CartView />} />
          <Route path="/orders" element={<div>orders-stub</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('checkout-success')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-form')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Перейти к заказам' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByText('orders-stub')).toBeInTheDocument();
  });

  it('CTA disabled, когда оформление запрещено', () => {
    useBuyerCart.mockReturnValue(cartState({ canCheckout: false, items: [entry()] }));
    renderCart();
    expect(screen.getByRole('button', { name: /Оформить заказ/ })).toBeDisabled();
  });

  it('select all: «Выбрать все» / «Снять всё»', async () => {
    const setAllSelected = vi.fn();
    useBuyerCart.mockReturnValue(
      cartState({ items: [entry()], selectionState: 'some', setAllSelected }),
    );
    const { unmount } = renderCart();
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать все' }));
    expect(setAllSelected).toHaveBeenCalledWith(true);
    unmount();

    useBuyerCart.mockReturnValue(
      cartState({ items: [entry()], selectionState: 'all', setAllSelected }),
    );
    renderCart();
    expect(screen.getByRole('button', { name: 'Снять всё' })).toBeInTheDocument();
  });

  it('удаление: trash → подтверждение → Да', async () => {
    const remove = vi.fn();
    useBuyerCart.mockReturnValue(
      cartState({ items: [entry({ productId: 'p1', variantId: 'v1', title: 'Товар' })], remove }),
    );
    renderCart();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить «Товар» из корзины' }));
    expect(screen.getByText('Удалить товар из корзины?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Да' }));
    expect(remove).toHaveBeenCalledWith('p1', 'v1');
    expect(screen.queryByText('Удалить товар из корзины?')).not.toBeInTheDocument();
  });

  it('недостаток стока: «Уменьшить до N» сокращает количество', async () => {
    const updateQty = vi.fn();
    useBuyerCart.mockReturnValue(
      cartState({
        items: [
          entry({
            productId: 'p1',
            variantId: 'v1',
            quantity: 5,
            availableQuantity: 2,
            orderable: false,
            title: 'Товар',
          }),
        ],
        updateQty,
        hasUnavailable: true,
        hasUnavailableSelected: true,
        canCheckout: false,
      }),
    );
    renderCart();

    await userEvent.click(screen.getByRole('button', { name: 'Уменьшить до 2' }));
    expect(updateQty).toHaveBeenCalledWith('p1', 'v1', 2);
  });

  it('ошибка пере-запроса: список сохранён + inline «Повторить»', async () => {
    const refresh = vi.fn();
    useBuyerCart.mockReturnValue(
      cartState({ error: 'boom', refresh, items: [entry({ title: 'Товар' })] }),
    );
    renderCart();

    expect(screen.getByText('Товар')).toBeInTheDocument();
    expect(screen.getByTestId('cart-inline-error')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('реконсиляция: индикатор и заблокированный CTA', () => {
    useBuyerCart.mockReturnValue(
      cartState({ reconciling: true, canCheckout: false, items: [entry()] }),
    );
    renderCart();

    expect(screen.getByTestId('cart-updating')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Оформить заказ/ })).toBeDisabled();
  });

  it('PAUSED: уведомление и заблокированный CTA', () => {
    useBuyerCart.mockReturnValue(
      cartState({ storePaused: true, canCheckout: false, items: [entry()] }),
    );
    renderCart();
    expect(
      screen.getByText('Магазин временно недоступен для оформления заказов.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Оформить заказ/ })).toBeDisabled();
  });
});

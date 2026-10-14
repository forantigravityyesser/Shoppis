// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';

type ToastShape = {
  id: string;
  text: string;
  imageUrl?: string | null;
  action?: string | null;
} | null;

const { clearToast, toastRef } = vi.hoisted(() => ({
  clearToast: vi.fn(),
  toastRef: { current: null as ToastShape },
}));

vi.mock('../../../application/store', () => ({
  useStore: (selector: (state: { toast: ToastShape; clearToast: () => void }) => unknown) =>
    selector({ toast: toastRef.current, clearToast }),
}));

import Toast from './Toast';

function renderToast() {
  return render(
    <MemoryRouter initialEntries={['/product/p1']}>
      <Routes>
        <Route path="/product/:id" element={<Toast />} />
        <Route path="/cart" element={<div>cart-screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  clearToast.mockReset();
  toastRef.current = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('без сообщения ничего не рендерит', () => {
    const { container } = renderToast();
    expect(container).toBeEmptyDOMElement();
  });

  it('рендерит текст и авто-скрывает через 2с', () => {
    vi.useFakeTimers();
    toastRef.current = { id: 't1', text: 'Добавлено в корзину' };

    renderToast();
    expect(screen.getByRole('status')).toHaveTextContent('Добавлено в корзину');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(clearToast).toHaveBeenCalledTimes(1);
  });

  it('с imageUrl показывает миниатюру товара', () => {
    toastRef.current = { id: 't2', text: 'Добавлено в корзину', imageUrl: 'thumb.jpg' };
    renderToast();
    const img = screen.getByRole('status').querySelector('img');
    expect(img).toHaveAttribute('src', 'thumb.jpg');
  });

  it('клик по тосту с action переводит на маршрут и скрывает тост', async () => {
    toastRef.current = {
      id: 't3',
      text: 'Добавлено в корзину',
      imageUrl: 'thumb.jpg',
      action: '/cart',
    };
    renderToast();

    await userEvent.click(screen.getByRole('button', { name: /Добавлено в корзину/ }));

    expect(clearToast).toHaveBeenCalledTimes(1);
    expect(screen.getByText('cart-screen')).toBeInTheDocument();
  });

  it('без action тост не кликабелен', () => {
    toastRef.current = { id: 't4', text: 'Готово' };
    renderToast();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

type ToastShape = { id: string; text: string; imageUrl?: string | null } | null;

const { clearToast, toastRef } = vi.hoisted(() => ({
  clearToast: vi.fn(),
  toastRef: { current: null as ToastShape },
}));

vi.mock('../../../application/store', () => ({
  useStore: (selector: (state: { toast: ToastShape; clearToast: () => void }) => unknown) =>
    selector({ toast: toastRef.current, clearToast }),
}));

import Toast from './Toast';

beforeEach(() => {
  clearToast.mockReset();
  toastRef.current = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('без сообщения ничего не рендерит', () => {
    const { container } = render(<Toast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('рендерит текст и авто-скрывает через 2с', () => {
    vi.useFakeTimers();
    toastRef.current = { id: 't1', text: 'Добавлено в корзину' };

    render(<Toast />);
    expect(screen.getByRole('status')).toHaveTextContent('Добавлено в корзину');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(clearToast).toHaveBeenCalledTimes(1);
  });

  it('с imageUrl показывает миниатюру товара', () => {
    toastRef.current = { id: 't2', text: 'Добавлено в корзину', imageUrl: 'thumb.jpg' };
    render(<Toast />);
    const img = screen.getByRole('status').querySelector('img');
    expect(img).toHaveAttribute('src', 'thumb.jpg');
  });
});

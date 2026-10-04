// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { MemoryRouter, useNavigate } from 'react-router';
import { useScrollToTop } from './useScrollToTop';

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  useScrollToTop(ref);
  const navigate = useNavigate();
  return (
    <>
      <div ref={ref} data-testid="scroller" style={{ overflowY: 'auto', height: 100 }}>
        <div style={{ height: 1000 }} />
      </div>
      <button type="button" onClick={() => navigate('/product/p1/reviews')}>
        reviews
      </button>
      <button type="button" onClick={() => navigate('/product/p1')}>
        about
      </button>
      <button type="button" onClick={() => navigate('/product/p2')}>
        other-product
      </button>
      <button type="button" onClick={() => navigate('/catalog')}>
        catalog
      </button>
    </>
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
    </MemoryRouter>,
  );
}

describe('useScrollToTop', () => {
  it('переход к слою Отзывов/Вопросов и назад сохраняет позицию скролла', async () => {
    renderAt('/product/p1');
    const scroller = screen.getByTestId('scroller');
    scroller.scrollTop = 50;

    await userEvent.click(screen.getByRole('button', { name: 'reviews' }));
    expect(scroller.scrollTop).toBe(50);

    await userEvent.click(screen.getByRole('button', { name: 'about' }));
    expect(scroller.scrollTop).toBe(50);
  });

  it('смена товара сбрасывает скролл', async () => {
    renderAt('/product/p1');
    const scroller = screen.getByTestId('scroller');
    scroller.scrollTop = 50;

    await userEvent.click(screen.getByRole('button', { name: 'other-product' }));
    expect(scroller.scrollTop).toBe(0);
  });

  it('выход из карточки на другой маршрут сбрасывает скролл', async () => {
    renderAt('/product/p1');
    const scroller = screen.getByTestId('scroller');
    scroller.scrollTop = 50;

    await userEvent.click(screen.getByRole('button', { name: 'catalog' }));
    expect(scroller.scrollTop).toBe(0);
  });
});

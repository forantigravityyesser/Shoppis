// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

vi.mock('../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({
    impactLight: vi.fn(),
    impactMedium: vi.fn(),
    notifySuccess: vi.fn(),
    selectTick: vi.fn(),
  }),
}));

vi.mock('../../application/store', () => ({
  useStore: (selector: (state: { toast: string | null; clearToast: () => void }) => unknown) =>
    selector({ toast: null, clearToast: vi.fn() }),
}));

import BuyerLayout from './BuyerLayout';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<BuyerLayout />}>
          <Route path="/" element={<div>home</div>} />
          <Route path="/catalog" element={<div>catalog</div>} />
          <Route path="/product/:id" element={<div>detail</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('BuyerLayout immersive mode', () => {
  it('показывает нижний навбар на главной', () => {
    renderAt('/');
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('показывает нижний навбар в каталоге', () => {
    renderAt('/catalog');
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('скрывает нижний навбар на /product/* и рендерит контент', () => {
    renderAt('/product/p1');
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByText('detail')).toBeInTheDocument();
  });
});

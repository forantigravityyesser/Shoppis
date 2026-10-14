// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { resetNavigationDepth } from '../can-go-back';
import BackButton from './BackButton';
import NavigationHistoryTracker from './NavigationHistoryTracker';

vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn() }),
}));

function Home() {
  return (
    <div>
      <span>HOME</span>
      <Link to="/product/p1">открыть товар</Link>
    </div>
  );
}

function Product() {
  return (
    <div>
      <span>PRODUCT</span>
      <BackButton fallback="/" />
    </div>
  );
}

function renderApp(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <NavigationHistoryTracker />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/product/:id" element={<Product />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetNavigationDepth();
});

describe('Глобальный «назад» (MemoryRouter)', () => {
  it('после перехода вперёд возвращает на предыдущий экран, а не на fallback', async () => {
    renderApp(['/']);

    await userEvent.click(screen.getByText('открыть товар'));
    expect(screen.getByText('PRODUCT')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  it('при прямом входе (нет истории) ведёт на fallback', async () => {
    renderApp(['/product/p1']);
    expect(screen.getByText('PRODUCT')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });
});

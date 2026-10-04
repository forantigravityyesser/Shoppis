// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { navigate, selectTick } = vi.hoisted(() => ({
  navigate: vi.fn(),
  selectTick: vi.fn(),
}));

vi.mock('react-router', () => ({ useNavigate: () => navigate }));
vi.mock('../../../application/hooks/useHaptic', () => ({ useHaptic: () => ({ selectTick }) }));

import BackButton from './BackButton';

beforeEach(() => {
  navigate.mockReset();
  selectTick.mockReset();
});

afterEach(() => {
  window.history.replaceState(null, '');
});

describe('BackButton', () => {
  it('есть история → navigate(-1) + haptic', async () => {
    window.history.replaceState({ idx: 2 }, '');
    render(<BackButton fallback="/" />);

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));

    expect(selectTick).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('нет истории → fallback с replace', async () => {
    window.history.replaceState({ idx: 0 }, '');
    render(<BackButton fallback="/catalog" />);

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));

    expect(navigate).toHaveBeenCalledWith('/catalog', { replace: true });
  });

  it('onClick перехватывает навигацию (haptic сохраняется)', async () => {
    window.history.replaceState({ idx: 2 }, '');
    const onClick = vi.fn();
    render(<BackButton fallback="/" onClick={onClick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));

    expect(selectTick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
});

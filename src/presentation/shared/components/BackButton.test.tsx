// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetNavigationDepth, setNavigationDepth } from '../can-go-back';

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
  resetNavigationDepth();
});

describe('BackButton', () => {
  it('есть история → navigate(-1) + haptic', async () => {
    setNavigationDepth(2);
    render(<BackButton fallback="/" />);

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));

    expect(selectTick).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('нет истории → fallback с replace', async () => {
    resetNavigationDepth();
    render(<BackButton fallback="/catalog" />);

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));

    expect(navigate).toHaveBeenCalledWith('/catalog', { replace: true });
  });

  it('onClick перехватывает навигацию (haptic сохраняется)', async () => {
    setNavigationDepth(2);
    const onClick = vi.fn();
    render(<BackButton fallback="/" onClick={onClick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));

    expect(selectTick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
});

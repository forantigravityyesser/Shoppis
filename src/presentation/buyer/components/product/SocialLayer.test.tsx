// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

const { navigate, selectTick, reduceRef, motionProps } = vi.hoisted(() => ({
  navigate: vi.fn(),
  selectTick: vi.fn(),
  reduceRef: { current: false },
  motionProps: { current: {} as Record<string, unknown> },
}));

vi.mock('react-router', () => ({ useNavigate: () => navigate }));
vi.mock('../../../../application/hooks/useHaptic', () => ({ useHaptic: () => ({ selectTick }) }));
vi.mock('framer-motion', () => ({
  motion: {
    div: (props: { children?: ReactNode } & Record<string, unknown>) => {
      motionProps.current = props;
      return <div data-testid="layer-motion">{props.children}</div>;
    },
  },
  useReducedMotion: () => reduceRef.current,
}));

import SocialLayer from './SocialLayer';

beforeEach(() => {
  navigate.mockReset();
  selectTick.mockReset();
  reduceRef.current = false;
  motionProps.current = {};
  window.history.replaceState({ idx: 2 }, '');
});

afterEach(() => {
  window.history.replaceState(null, '');
});

describe('SocialLayer', () => {
  it('рендерит заголовок и контент', () => {
    render(
      <SocialLayer title="Отзывы" backTo="/product/p1">
        <p>контент слоя</p>
      </SocialLayer>,
    );
    expect(screen.getByText('Отзывы')).toBeInTheDocument();
    expect(screen.getByText('контент слоя')).toBeInTheDocument();
  });

  it('reduced-motion → назад навигирует сразу', async () => {
    reduceRef.current = true;
    render(
      <SocialLayer title="Отзывы" backTo="/product/p1">
        x
      </SocialLayer>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('анимация → навигация после завершения exit', async () => {
    render(
      <SocialLayer title="Отзывы" backTo="/product/p1">
        x
      </SocialLayer>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    // Пока анимация не завершилась — навигации нет.
    expect(navigate).not.toHaveBeenCalled();

    const onComplete = motionProps.current.onAnimationComplete as () => void;
    onComplete();
    expect(navigate).toHaveBeenCalledWith(-1);
  });
});

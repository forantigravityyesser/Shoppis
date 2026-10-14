// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

type Dot = { id: string; imageUrl: string; target: 'cart' | 'favorites'; x: number; y: number };

const { dropAnimation, animationsRef } = vi.hoisted(() => ({
  dropAnimation: vi.fn(),
  animationsRef: { current: [] as Dot[] },
}));

vi.mock('../../../application/store', () => ({
  useStore: (selector: (state: { animations: Dot[]; dropAnimation: () => void }) => unknown) =>
    selector({ animations: animationsRef.current, dropAnimation }),
}));

import FlyingAnimations from './FlyingAnimations';

beforeEach(() => {
  dropAnimation.mockReset();
  animationsRef.current = [];
});

describe('FlyingAnimations', () => {
  it('без очереди ничего не рендерит', () => {
    const { container } = render(<FlyingAnimations />);
    expect(container).toBeEmptyDOMElement();
  });

  it('рендерит летящую карточку с фото товара', () => {
    animationsRef.current = [
      { id: 'a1', imageUrl: 'thumb.jpg', target: 'favorites', x: 10, y: 20 },
    ];
    render(<FlyingAnimations />);
    const img = document.querySelector('.fly-card__img');
    expect(img).toHaveAttribute('src', 'thumb.jpg');
  });

  it('без фото рисует цветную заглушку', () => {
    animationsRef.current = [{ id: 'a2', imageUrl: '', target: 'favorites', x: 0, y: 0 }];
    render(<FlyingAnimations />);
    expect(document.querySelector('.fly-card__fallback')).not.toBeNull();
  });
});

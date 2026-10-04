// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SafeImage from './SafeImage';

const fallback = <span data-testid="fallback">FB</span>;

describe('SafeImage', () => {
  it('null URL → fallback, без <img>', () => {
    render(<SafeImage src={null} alt="A" className="img" fallback={fallback} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('валидный src → <img> с lazy по умолчанию и async-декодированием', () => {
    render(<SafeImage src="https://cdn/a.jpg" alt="A" className="img" fallback={fallback} />);
    const img = screen.getByRole('img', { name: 'A' });
    expect(img).toHaveAttribute('src', 'https://cdn/a.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveClass('img');
    expect(screen.queryByTestId('fallback')).toBeNull();
  });

  it('loading="eager" пробрасывается (баннер)', () => {
    render(<SafeImage src="https://cdn/b.jpg" alt="B" loading="eager" fallback={fallback} />);
    expect(screen.getByRole('img', { name: 'B' })).toHaveAttribute('loading', 'eager');
  });

  it('broken URL → fallback', () => {
    render(<SafeImage src="https://cdn/broken.jpg" alt="A" fallback={fallback} />);
    fireEvent.error(screen.getByRole('img', { name: 'A' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('смена src после сбоя снова показывает изображение', () => {
    const { rerender } = render(
      <SafeImage src="https://cdn/broken.jpg" alt="A" fallback={fallback} />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'A' }));
    expect(screen.queryByRole('img')).toBeNull();

    rerender(<SafeImage src="https://cdn/fixed.jpg" alt="A" fallback={fallback} />);
    expect(screen.getByRole('img', { name: 'A' })).toHaveAttribute('src', 'https://cdn/fixed.jpg');
  });
});

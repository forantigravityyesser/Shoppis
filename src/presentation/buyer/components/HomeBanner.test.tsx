// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import HomeBanner from './HomeBanner';

describe('HomeBanner', () => {
  it('рендерит изображение баннера с alt магазина', () => {
    render(<HomeBanner bannerUrl="https://cdn/banner.jpg" storeName="Nike Shop" />);
    expect(screen.getByRole('img', { name: 'Nike Shop' })).toHaveAttribute(
      'src',
      'https://cdn/banner.jpg',
    );
  });

  it('без баннера — заглушка (без img)', () => {
    const { container } = render(<HomeBanner bannerUrl={null} storeName="Nike Shop" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('.home-banner__placeholder')).not.toBeNull();
  });

  it('битое изображение → заглушка', () => {
    const { container } = render(
      <HomeBanner bannerUrl="https://cdn/broken.jpg" storeName="Nike Shop" />,
    );
    fireEvent.error(container.querySelector('.home-banner__img') as HTMLImageElement);
    expect(container.querySelector('.home-banner__placeholder')).not.toBeNull();
  });
});

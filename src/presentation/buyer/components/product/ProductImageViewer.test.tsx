// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductImageViewer from './ProductImageViewer';
import type { StorefrontProductImage } from '../../../../application/read-models/storefront-product';

const images: StorefrontProductImage[] = [
  { url: 'https://cdn/a.jpg', thumbUrl: 'https://cdn/a-t.jpg', sortOrder: 0 },
  { url: 'https://cdn/b.jpg', thumbUrl: null, sortOrder: 1 },
];

function setup(props: Partial<Parameters<typeof ProductImageViewer>[0]> = {}) {
  const onClose = vi.fn();
  const onSelect = vi.fn();
  const view = render(
    <ProductImageViewer
      images={images}
      activeIndex={0}
      title="Товар"
      onClose={onClose}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { onClose, onSelect, ...view };
}

describe('ProductImageViewer', () => {
  it('рендерит активное фото и thumbs', () => {
    setup();
    expect(screen.getByRole('img', { name: 'Товар' })).toHaveAttribute('src', 'https://cdn/a.jpg');
    expect(screen.getByLabelText('Фото 2')).toBeInTheDocument();
  });

  it('Escape → onClose', () => {
    const { onClose } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('клик по кнопке закрытия → onClose', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
  });

  it('клик по фону (диалогу) → onClose', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('клик по фото не закрывает просмотр', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('img', { name: 'Товар' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('клик по миниатюре → onSelect(index) и не закрывает', () => {
    const { onClose, onSelect } = setup();
    fireEvent.click(screen.getByLabelText('Фото 2'));
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('одно фото → миниатюр нет', () => {
    setup({ images: [images[0]] });
    expect(screen.queryByLabelText('Фото 1')).toBeNull();
  });

  it('смена activeIndex меняет показанное фото', () => {
    const { rerender } = setup();
    rerender(
      <ProductImageViewer
        images={images}
        activeIndex={1}
        title="Товар"
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('img', { name: 'Товар' })).toHaveAttribute('src', 'https://cdn/b.jpg');
  });
});

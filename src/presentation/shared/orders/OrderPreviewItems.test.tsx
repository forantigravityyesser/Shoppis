// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderPreviewItems from './OrderPreviewItems';

const preview = (title: string, imageUrl: string | null, quantity = 1) => ({
  imageUrl,
  title,
  variantLabel: null,
  quantity,
});

describe('OrderPreviewItems', () => {
  it('рендерит миниатюры и placeholder при отсутствии изображения', () => {
    render(
      <OrderPreviewItems
        itemCount={2}
        previewItems={[preview('Толстовка', 'https://cdn/a.jpg'), preview('Худи', null)]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Толстовка' })).toHaveAttribute(
      'src',
      'https://cdn/a.jpg',
    );
    // null-изображение → placeholder, без broken <img>
    expect(screen.queryByRole('img', { name: 'Худи' })).toBeNull();
  });

  it('показывает +N, если позиций больше, чем превью', () => {
    render(
      <OrderPreviewItems
        itemCount={5}
        previewItems={[preview('A', null), preview('B', null), preview('C', null)]}
      />,
    );
    expect(screen.getByTestId('order-preview-more')).toHaveTextContent('+2');
  });

  it('без +N, когда превью покрывает все позиции', () => {
    render(<OrderPreviewItems itemCount={1} previewItems={[preview('A', null)]} />);
    expect(screen.queryByTestId('order-preview-more')).toBeNull();
  });

  it('пустой список превью → ничего не рендерит', () => {
    const { container } = render(<OrderPreviewItems itemCount={0} previewItems={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('количество > 1 показывается бейджем', () => {
    render(<OrderPreviewItems itemCount={1} previewItems={[preview('A', null, 3)]} />);
    expect(screen.getByLabelText('Количество 3')).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { selectTick } = vi.hoisted(() => ({ selectTick: vi.fn() }));

vi.mock('../../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({
    selectTick,
    impactLight: vi.fn(),
    impactMedium: vi.fn(),
    notifySuccess: vi.fn(),
  }),
}));

import ProductGallery from './ProductGallery';
import type { StorefrontProductImage } from '../../../../application/read-models/storefront-product';

const image = (n: number, thumb: string | null = `t${n}`): StorefrontProductImage => ({
  url: `full${n}`,
  thumbUrl: thumb,
  sortOrder: n,
});

beforeEach(() => selectTick.mockReset());

describe('ProductGallery', () => {
  it('0 фото → плейсхолдер, без миниатюр', () => {
    render(<ProductGallery images={[]} title="Nike T-Shirt" />);
    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.queryByTestId('product-thumbs')).toBeNull();
  });

  it('1 фото → главное без миниатюр', () => {
    render(<ProductGallery images={[image(1)]} title="Nike" />);
    expect(screen.getByAltText('Nike')).toHaveAttribute('src', 'full1');
    expect(screen.queryByTestId('product-thumbs')).toBeNull();
  });

  it('2 фото → одна миниатюра (второе фото)', () => {
    render(<ProductGallery images={[image(1), image(2)]} title="Nike" />);
    expect(screen.getByAltText('Nike')).toHaveAttribute('src', 'full1');
    const thumbs = screen.getByTestId('product-thumbs');
    expect(thumbs.querySelectorAll('button')).toHaveLength(1);
    expect(screen.getByLabelText('Фото 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Фото 1')).toBeNull();
  });

  it('3 фото → две миниатюры', () => {
    render(<ProductGallery images={[image(1), image(2), image(3)]} title="Nike" />);
    const thumbs = screen.getByTestId('product-thumbs');
    expect(thumbs.querySelectorAll('button')).toHaveLength(2);
    expect(screen.getByLabelText('Фото 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Фото 3')).toBeInTheDocument();
    expect(screen.queryByLabelText('Фото 1')).toBeNull();
  });

  it('4 фото → миниатюры = все, кроме активной', () => {
    render(<ProductGallery images={[image(1), image(2), image(3), image(4)]} title="Nike" />);
    expect(screen.getByAltText('Nike')).toHaveAttribute('src', 'full1');

    const thumbs = screen.getByTestId('product-thumbs');
    expect(thumbs.querySelectorAll('button')).toHaveLength(3);
    expect(screen.queryByLabelText('Фото 1')).toBeNull();
    expect(screen.getByLabelText('Фото 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Фото 4')).toBeInTheDocument();
  });

  it('клик по миниатюре → swap + haptic', async () => {
    render(<ProductGallery images={[image(1), image(2), image(3), image(4)]} title="Nike" />);

    await userEvent.click(screen.getByLabelText('Фото 3'));

    expect(selectTick).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText('Nike')).toHaveAttribute('src', 'full3');
    // Активным стал 3-й: в ряду 1, 2, 4; третьего больше нет.
    expect(screen.getByLabelText('Фото 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Фото 3')).toBeNull();
  });

  it('клик по главному фото → fullscreen; переключение и закрытие', async () => {
    render(<ProductGallery images={[image(1), image(2)]} title="Nike" />);
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByAltText('Nike'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Переключение фото внутри вьюера.
    await userEvent.click(within(dialog).getByLabelText('Фото 2'));
    expect(within(dialog).getByAltText('Nike')).toHaveAttribute('src', 'full2');

    await userEvent.click(within(dialog).getByLabelText('Закрыть'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('thumbUrl null → миниатюра использует full url', () => {
    render(<ProductGallery images={[image(1), image(2, null)]} title="Nike" />);
    const thumb = screen.getByLabelText('Фото 2');
    expect(thumb.querySelector('img')).toHaveAttribute('src', 'full2');
  });
});

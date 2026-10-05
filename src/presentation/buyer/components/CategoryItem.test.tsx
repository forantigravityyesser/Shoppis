// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryItem from './CategoryItem';

describe('CategoryItem', () => {
  it('показывает фото категории и название', () => {
    const { container } = render(
      <CategoryItem id="c1" name="Обувь" imageUrl="https://cdn/cat.jpg" onSelect={vi.fn()} />,
    );
    const img = container.querySelector('.category-item__img');
    expect(img).toHaveAttribute('src', 'https://cdn/cat.jpg');
    expect(screen.getByText('Обувь')).toBeInTheDocument();
  });

  it('без обложки — заглушка с первой буквой', () => {
    render(<CategoryItem id="c1" name="обувь" imageUrl={null} onSelect={vi.fn()} />);
    expect(screen.getByText('О')).toBeInTheDocument();
  });

  it('вызывает onSelect с id при нажатии', async () => {
    const onSelect = vi.fn();
    render(<CategoryItem id="c1" name="Обувь" imageUrl={null} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'Обувь' }));
    expect(onSelect).toHaveBeenCalledWith('c1');
  });

  it('битая обложка → заглушка с первой буквой', () => {
    const { container } = render(
      <CategoryItem id="c1" name="Обувь" imageUrl="https://cdn/broken.jpg" onSelect={vi.fn()} />,
    );
    fireEvent.error(container.querySelector('.category-item__img') as HTMLImageElement);
    expect(screen.getByText('О')).toBeInTheDocument();
  });

  it('заглушка красится по позиции (variant 1..8), без variant — базовая', () => {
    const { container } = render(
      <CategoryItem id="c1" name="Обувь" imageUrl={null} onSelect={vi.fn()} variant={3} />,
    );
    expect(container.querySelector('.category-item__placeholder--3')).toBeTruthy();
  });

  it('variant=9 сворачивается в палитру 1..8', () => {
    const { container } = render(
      <CategoryItem id="c1" name="Обувь" imageUrl={null} onSelect={vi.fn()} variant={9} />,
    );
    expect(container.querySelector('.category-item__placeholder--1')).toBeTruthy();
  });
});

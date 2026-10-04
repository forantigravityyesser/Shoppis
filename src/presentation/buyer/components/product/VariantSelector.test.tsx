// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StorefrontProductVariant } from '../../../../application/read-models/storefront-product';
import VariantSelector from './VariantSelector';

const variant = (
  id: string,
  value: string,
  available = true,
): StorefrontProductVariant => ({
  id,
  name: 'Размер',
  value,
  price: 100,
  originalPrice: null,
  availableQuantity: available ? 1 : 0,
  available,
});

describe('VariantSelector', () => {
  it('без вариантов ничего не рендерит', () => {
    const { container } = render(
      <VariantSelector variants={[]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('рендерит таблетки, выбранную подсвечивает, sold-out недоступна', () => {
    render(
      <VariantSelector
        variants={[variant('s', 'S'), variant('m', 'M', false), variant('l', 'L')]}
        selectedId="s"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'S' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'L' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'M' })).toBeDisabled();
  });

  it('показывает счётчик вариантов', () => {
    render(
      <VariantSelector variants={[variant('s', 'S'), variant('l', 'L')]} selectedId="s" onSelect={vi.fn()} />,
    );
    expect(screen.getByLabelText('Доступно вариантов: 2')).toBeInTheDocument();
  });

  it('клик по доступному варианту вызывает onSelect с id', async () => {
    const onSelect = vi.fn();
    render(
      <VariantSelector variants={[variant('s', 'S'), variant('l', 'L')]} selectedId="s" onSelect={onSelect} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'L' }));
    expect(onSelect).toHaveBeenCalledWith('l');
  });
});

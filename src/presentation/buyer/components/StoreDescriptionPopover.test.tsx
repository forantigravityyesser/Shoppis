// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StoreDescriptionPopover from './StoreDescriptionPopover';

describe('StoreDescriptionPopover', () => {
  it('не рендерится, когда закрыт', () => {
    render(<StoreDescriptionPopover open={false} description="О нас" onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('показывает заголовок и текст описания', () => {
    render(<StoreDescriptionPopover open description="Лучший магазин" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'О магазине' })).toBeInTheDocument();
    expect(screen.getByText('Лучший магазин')).toBeInTheDocument();
  });

  it('закрывается по клику на фон', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <StoreDescriptionPopover open description="О нас" onClose={onClose} />,
    );

    await userEvent.click(container.querySelector('.store-about__backdrop') as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('закрывается по Escape', async () => {
    const onClose = vi.fn();
    render(<StoreDescriptionPopover open description="О нас" onClose={onClose} />);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

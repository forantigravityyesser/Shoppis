// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardInventoryBlock from './DashboardInventoryBlock';

const inventory = { activeProducts: 7, archivedProducts: 2, activeCategories: 3 };

describe('DashboardInventoryBlock (docs/25 §4.2)', () => {
  it('карточка «Товары»: значения и тона витрины/архива', () => {
    render(
      <DashboardInventoryBlock
        inventory={inventory}
        onOpenProducts={() => {}}
        onOpenCategories={() => {}}
      />,
    );
    const products = screen.getByRole('button', { name: /Товары/ });
    expect(products).toHaveTextContent('На витрине');
    expect(products).toHaveTextContent('В архиве');
    const tones = within(products)
      .getAllByTestId('dashboard-stat')
      .map((s) => s.getAttribute('data-tone'));
    expect(tones).toEqual(['active', 'archive']);
  });

  it('карточка «Категории»: количество активных категорий', () => {
    render(
      <DashboardInventoryBlock
        inventory={inventory}
        onOpenProducts={() => {}}
        onOpenCategories={() => {}}
      />,
    );
    const categories = screen.getByRole('button', { name: /Категории/ });
    expect(categories).toHaveTextContent('Активных');
    expect(within(categories).getByTestId('dashboard-stat')).toHaveTextContent('3');
  });

  it('клик по «Товары» → onOpenProducts', async () => {
    const onOpenProducts = vi.fn();
    render(
      <DashboardInventoryBlock
        inventory={inventory}
        onOpenProducts={onOpenProducts}
        onOpenCategories={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Товары/ }));
    expect(onOpenProducts).toHaveBeenCalledTimes(1);
  });

  it('клик по «Категории» → onOpenCategories', async () => {
    const onOpenCategories = vi.fn();
    render(
      <DashboardInventoryBlock
        inventory={inventory}
        onOpenProducts={() => {}}
        onOpenCategories={onOpenCategories}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Категории/ }));
    expect(onOpenCategories).toHaveBeenCalledTimes(1);
  });

  it('нулевые значения отображаются', () => {
    render(
      <DashboardInventoryBlock
        inventory={{ activeProducts: 0, archivedProducts: 0, activeCategories: 0 }}
        onOpenProducts={() => {}}
        onOpenCategories={() => {}}
      />,
    );
    expect(screen.getAllByTestId('dashboard-stat')).toHaveLength(3);
    screen.getAllByTestId('dashboard-stat').forEach((stat) => expect(stat).toHaveTextContent('0'));
  });
});

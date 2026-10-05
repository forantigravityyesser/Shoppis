// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CatalogAppliedFilters from './CatalogAppliedFilters';

describe('CatalogAppliedFilters', () => {
  it('без фильтров ничего не рендерит', () => {
    const { container } = render(
      <CatalogAppliedFilters
        categoryName={null}
        priceLabel={null}
        onRemoveCategory={vi.fn()}
        onRemovePrice={vi.fn()}
      />,
    );
    expect(container.querySelector('.catalog-applied')).toBeNull();
  });

  it('чип категории виден и снимается', async () => {
    const onRemoveCategory = vi.fn();
    render(
      <CatalogAppliedFilters
        categoryName="Обувь"
        priceLabel={null}
        onRemoveCategory={onRemoveCategory}
        onRemovePrice={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Убрать фильтр «Обувь»' }));
    expect(onRemoveCategory).toHaveBeenCalledTimes(1);
  });

  it('оба чипа видны; чип цены снимается', async () => {
    const onRemovePrice = vi.fn();
    render(
      <CatalogAppliedFilters
        categoryName="Обувь"
        priceLabel="80 € – 3200 €"
        onRemoveCategory={vi.fn()}
        onRemovePrice={onRemovePrice}
      />,
    );

    expect(screen.getByText('Обувь')).toBeInTheDocument();
    expect(screen.getByText('80 € – 3200 €')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Убрать фильтр цены 80 € – 3200 €' }),
    );
    expect(onRemovePrice).toHaveBeenCalledTimes(1);
  });
});

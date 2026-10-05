// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CatalogCategoryTiles from './CatalogCategoryTiles';
import type { StorefrontCategory } from '../../../application/read-models/storefront';

function cat(id: string, name: string, imageUrl: string | null = null): StorefrontCategory {
  return { id, name, imageUrl, sortOrder: 0 };
}

function renderTiles(overrides: Partial<ComponentProps<typeof CatalogCategoryTiles>> = {}) {
  const props = {
    categories: [cat('a', 'A'), cat('b', 'B'), cat('c', 'C')],
    activeId: null as string | null,
    onSelect: vi.fn(),
    onViewAll: vi.fn(),
    ...overrides,
  };
  render(<CatalogCategoryTiles {...props} />);
  return props;
}

describe('CatalogCategoryTiles', () => {
  it('рендерит максимум 8 карточек в порядке продавца + стрелку', () => {
    const categories = Array.from({ length: 10 }, (_, i) => cat(`c${i}`, `К${i}`));
    renderTiles({ categories });

    // 8 карточек + стрелка
    expect(screen.getAllByRole('button')).toHaveLength(9);
    expect(screen.getByRole('button', { name: 'К0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'К7' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'К8' })).toBeNull();
  });

  it('активная категория помечена, клик → onSelect(id)', async () => {
    const props = renderTiles({ activeId: 'b' });

    expect(screen.getByRole('button', { name: 'B' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(props.onSelect).toHaveBeenCalledWith('a');
  });

  it('без фото заглушка красится по позиции (1..8)', () => {
    const categories = Array.from({ length: 8 }, (_, i) => cat(`c${i}`, `К${i}`));
    const { container } = render(
      <CatalogCategoryTiles
        categories={categories}
        activeId={null}
        onSelect={vi.fn()}
        onViewAll={vi.fn()}
      />,
    );

    for (let position = 1; position <= 8; position += 1) {
      expect(container.querySelector(`.category-item__placeholder--${position}`)).toBeTruthy();
    }
  });

  it('стрелка «Все категории» → onViewAll', async () => {
    const props = renderTiles();
    await userEvent.click(screen.getByRole('button', { name: 'Все категории' }));
    expect(props.onViewAll).toHaveBeenCalledTimes(1);
  });

  it('пустой список → ничего не рендерит', () => {
    const { container } = render(
      <CatalogCategoryTiles
        categories={[]}
        activeId={null}
        onSelect={vi.fn()}
        onViewAll={vi.fn()}
      />,
    );
    expect(container.querySelector('.catalog-cats')).toBeNull();
  });
});

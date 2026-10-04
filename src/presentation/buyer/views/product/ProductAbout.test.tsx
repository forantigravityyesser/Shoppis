// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import type { StorefrontProductDetail } from '../../../../application/read-models/storefront-product';
import ProductAbout from './ProductAbout';

function makeDetail(overrides: Partial<StorefrontProductDetail> = {}): StorefrontProductDetail {
  return {
    store: {
      id: 's1',
      publicId: 'pub1',
      name: 'Nike',
      bannerUrl: null,
      status: 'ACTIVE',
      currencyCode: 'USD',
      currencySymbol: '$',
    },
    product: { id: 'p1', title: 'T', description: 'Короткое описание', categoryId: null },
    images: [],
    linkAttributes: [],
    attributes: [],
    variants: [],
    rating: { average: 0, count: 0 },
    questionsCount: 0,
    relatedProducts: [],
    ...overrides,
  };
}

function renderAbout(detail: StorefrontProductDetail) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={detail} />}>
          <Route path="/" element={<ProductAbout />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductAbout', () => {
  it('короткое описание — без «Подробнее», характеристики показаны', () => {
    renderAbout(makeDetail({ attributes: [{ name: 'Материал', value: 'Хлопок' }] }));

    expect(screen.getByText('Короткое описание')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Подробнее/ })).toBeNull();
    expect(screen.getByText('Характеристики')).toBeInTheDocument();
    expect(screen.getByText('Материал')).toBeInTheDocument();
    expect(screen.getByText('Хлопок')).toBeInTheDocument();
  });

  it('длинное описание — «Подробнее» раскрывает, «Свернуть» сворачивает', async () => {
    const long =
      'Очень длинное описание товара, которое точно не помещается в две строки и требует раскрытия по нажатию кнопки.';
    renderAbout(makeDetail({ product: { id: 'p1', title: 'T', description: long, categoryId: null } }));

    await userEvent.click(screen.getByRole('button', { name: /Подробнее/ }));
    expect(screen.getByRole('button', { name: 'Свернуть' })).toBeInTheDocument();
    expect(screen.getByText(long)).toBeInTheDocument();
  });

  it('нет характеристик — блока нет', () => {
    renderAbout(makeDetail({ attributes: [] }));
    expect(screen.queryByText('Характеристики')).toBeNull();
  });
});

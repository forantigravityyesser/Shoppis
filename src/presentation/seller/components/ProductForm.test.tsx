// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProductForm from './ProductForm';
import { detailToFormValues, type ProductFormValues } from './product-form-values';
import type { InventoryProductDetail } from '../../../application/hooks/useProduct';
import type { VariantForm } from '../../../application/rules/variant-form';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function fillPublishableForm() {
  await userEvent.type(screen.getByPlaceholderText('Например, Морковь'), 'Морковь');
  await userEvent.type(screen.getByPlaceholderText('42 / XL / 500 мл / 128 GB'), '1 кг');
  await userEvent.type(screen.getByPlaceholderText('0.00'), '100');
}

describe('ProductForm — отправка (docs/19 §12, §33)', () => {
  it('не отправляет повторно и показывает прогресс во время публикации', async () => {
    const deferred = createDeferred<void>();
    const onSubmit = vi.fn(() => deferred.promise);
    render(<ProductForm categories={[]} onSubmit={onSubmit} />);

    await fillPublishableForm();

    const publish = screen.getByRole('button', { name: 'На витрину' });
    expect(publish).toBeEnabled();

    await userEvent.click(publish);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const progress = await screen.findByRole('button', { name: 'Публикация…' });
    expect(progress).toBeDisabled();

    fireEvent.click(progress);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    deferred.resolve();
    await waitFor(() => expect(screen.getByRole('button', { name: 'На витрину' })).toBeEnabled());
  });

  it('сохраняет форму, показывает ошибку и позволяет повторить', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('Сервер недоступен'))
      .mockResolvedValueOnce(undefined);
    render(<ProductForm categories={[]} onSubmit={onSubmit} />);

    await fillPublishableForm();
    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Сервер недоступен');
    expect(screen.getByPlaceholderText('Например, Морковь')).toHaveValue('Морковь');
    expect(screen.getByPlaceholderText('42 / XL / 500 мл / 128 GB')).toHaveValue('1 кг');

    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });

  it('блокирует публикацию без цены, но оставляет архивацию', async () => {
    render(<ProductForm categories={[]} onSubmit={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText('Например, Морковь'), 'Морковь');

    expect(screen.getByRole('button', { name: 'На витрину' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'В архив' })).toBeEnabled();
  });
});

function formVariant(overrides: Partial<VariantForm> = {}): VariantForm {
  return {
    name: 'Объём',
    value: '1 кг',
    quantity: '5',
    price: '1900',
    discount: '0',
    priceMode: 'INHERITED',
    discountMode: 'INHERITED',
    ...overrides,
  };
}

function renderTwoVariants() {
  const onSubmit = vi.fn();
  const initial: Partial<ProductFormValues> = {
    title: 'Морковь',
    variants: [formVariant(), formVariant({ value: '2 кг' })],
  };
  render(<ProductForm categories={[]} initial={initial} onSubmit={onSubmit} />);
  return { onSubmit };
}

describe('ProductForm — независимые оси варианта (docs/20 §3.1)', () => {
  it('custom-скидка без custom-цены: цена остаётся inherited', async () => {
    const { onSubmit } = renderTwoVariants();

    await userEvent.click(screen.getByRole('button', { name: /Вариант 2/ }));
    const discount = screen.getByPlaceholderText('0');
    await userEvent.clear(discount);
    await userEvent.type(discount, '20');

    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0][0].variants[1]).toMatchObject({
      value: '2 кг',
      priceMinor: 190000,
      discountPercent: 20,
      priceMode: 'INHERITED',
      discountMode: 'CUSTOM',
    });
  });

  it('custom-цена без custom-скидки: скидка остаётся inherited', async () => {
    const { onSubmit } = renderTwoVariants();

    await userEvent.click(screen.getByRole('button', { name: /Вариант 2/ }));
    const price = screen.getByPlaceholderText('0.00');
    await userEvent.clear(price);
    await userEvent.type(price, '2200');

    await userEvent.click(screen.getByRole('button', { name: 'На витрину' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0][0].variants[1]).toMatchObject({
      priceMinor: 220000,
      priceMode: 'CUSTOM',
      discountMode: 'INHERITED',
    });
  });
});

type DetailVariant = InventoryProductDetail['variants'][number];

function detailVariant(overrides: Partial<DetailVariant> = {}): DetailVariant {
  return {
    id: 'v',
    name: 'Объём',
    value: '1 кг',
    originalAmountMinor: 190000,
    priceMinor: 190000,
    discountPercent: 0,
    availableQuantity: 5,
    heldQuantity: 0,
    priceMode: 'USE_PRODUCT_PRICE',
    customOriginalAmountMinor: null,
    customDiscountPercent: null,
    ...overrides,
  };
}

function makeDetail(variants: DetailVariant[]): InventoryProductDetail {
  return {
    id: 'p1',
    categoryId: null,
    categoryName: 'Без категории',
    title: 'Морковь',
    description: '',
    status: 'ACTIVE',
    images: [],
    emoji: '📦',
    originalAmountMinor: 190000,
    discountPercent: 0,
    priceMinor: 190000,
    currency: 'RUB',
    attributes: [],
    variants,
    stockAvailable: 10,
    stockHeld: 0,
    stockState: 'in_stock',
    rating: 0,
    reviewsCount: 0,
    questionsCount: 0,
  };
}

describe('detailToFormValues — round-trip осей', () => {
  it('разводит режимы по null-ности конкретного поля', () => {
    const values = detailToFormValues(
      makeDetail([
        detailVariant({ id: 'v1' }),
        detailVariant({
          id: 'v2',
          value: '2 кг',
          priceMode: 'CUSTOM_PRICE',
          customOriginalAmountMinor: null,
          customDiscountPercent: 20,
          discountPercent: 20,
        }),
        detailVariant({
          id: 'v3',
          value: '3 кг',
          priceMode: 'CUSTOM_PRICE',
          customOriginalAmountMinor: 220000,
          customDiscountPercent: null,
          originalAmountMinor: 220000,
          priceMinor: 220000,
        }),
      ]),
    );

    expect(values.variants[0]).toMatchObject({ priceMode: 'INHERITED', discountMode: 'INHERITED' });
    expect(values.variants[1]).toMatchObject({ priceMode: 'INHERITED', discountMode: 'CUSTOM' });
    expect(values.variants[2]).toMatchObject({ priceMode: 'CUSTOM', discountMode: 'INHERITED' });
  });
});

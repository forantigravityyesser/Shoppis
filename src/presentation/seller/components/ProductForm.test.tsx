// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProductForm from './ProductForm';

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

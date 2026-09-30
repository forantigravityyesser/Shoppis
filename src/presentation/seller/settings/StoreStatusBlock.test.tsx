// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StoreStatusBlock from './StoreStatusBlock';
import type { Store } from '../../../domain/models/store';

function makeStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 's1',
    ownerUserId: 'u1',
    ownerTelegramId: 'tg1',
    name: 'Shop',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    supportHandle: '',
    currencyCode: 'USD',
    currencySymbol: '$',
    language: 'ru',
    status: 'ACTIVE',
    publicId: 'pub1',
    createdAt: '2026-09-30T00:00:00.000Z',
    ...overrides,
  };
}

function saveButton() {
  return screen.queryByRole('button', { name: 'Сохранить' });
}

describe('StoreStatusBlock', () => {
  it('активный магазин: переключатель включён, Save скрыт', () => {
    render(<StoreStatusBlock store={makeStore()} onSaveStatus={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Магазин активен' })).toBeChecked();
    expect(saveButton()).toBeNull();
  });

  it('при выключении показывает Save, но не сохраняет сразу', async () => {
    const user = userEvent.setup();
    const onSaveStatus = vi.fn().mockResolvedValue(undefined);
    render(<StoreStatusBlock store={makeStore()} onSaveStatus={onSaveStatus} />);

    await user.click(screen.getByRole('switch', { name: 'Магазин активен' }));
    expect(saveButton()).toBeInTheDocument();

    await user.click(saveButton() as HTMLElement);
    expect(onSaveStatus).not.toHaveBeenCalled();
    expect(screen.getByText(/Магазин временно закроется/)).toBeInTheDocument();
  });

  it('подтверждение паузы сохраняет статус PAUSED', async () => {
    const user = userEvent.setup();
    const onSaveStatus = vi.fn().mockResolvedValue(undefined);
    render(<StoreStatusBlock store={makeStore()} onSaveStatus={onSaveStatus} />);

    await user.click(screen.getByRole('switch', { name: 'Магазин активен' }));
    await user.click(saveButton() as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Приостановить' }));

    expect(onSaveStatus).toHaveBeenCalledWith('PAUSED');
  });

  it('отмена подтверждения не сохраняет и оставляет draft', async () => {
    const user = userEvent.setup();
    const onSaveStatus = vi.fn();
    render(<StoreStatusBlock store={makeStore()} onSaveStatus={onSaveStatus} />);

    await user.click(screen.getByRole('switch', { name: 'Магазин активен' }));
    await user.click(saveButton() as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(onSaveStatus).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Магазин активен' })).not.toBeChecked();
    expect(saveButton()).toBeInTheDocument();
  });

  it('включение приостановленного магазина сохраняет ACTIVE без подтверждения', async () => {
    const user = userEvent.setup();
    const onSaveStatus = vi.fn().mockResolvedValue(undefined);
    render(<StoreStatusBlock store={makeStore({ status: 'PAUSED' })} onSaveStatus={onSaveStatus} />);

    expect(screen.getByRole('switch', { name: 'Магазин активен' })).not.toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'Магазин активен' }));
    await user.click(saveButton() as HTMLElement);

    expect(onSaveStatus).toHaveBeenCalledWith('ACTIVE');
  });

  it('при ошибке сохраняет draft и показывает сообщение', async () => {
    const user = userEvent.setup();
    const onSaveStatus = vi.fn().mockRejectedValue(new Error('FORBIDDEN'));
    render(<StoreStatusBlock store={makeStore()} onSaveStatus={onSaveStatus} />);

    await user.click(screen.getByRole('switch', { name: 'Магазин активен' }));
    await user.click(saveButton() as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Приостановить' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('FORBIDDEN'));
    expect(screen.getByRole('switch', { name: 'Магазин активен' })).not.toBeChecked();
  });

  it('после сохранения блок становится чистым', async () => {
    const user = userEvent.setup();
    const onSaveStatus = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <StoreStatusBlock store={makeStore()} onSaveStatus={onSaveStatus} />,
    );

    await user.click(screen.getByRole('switch', { name: 'Магазин активен' }));
    await user.click(saveButton() as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Приостановить' }));

    rerender(<StoreStatusBlock store={makeStore({ status: 'PAUSED' })} onSaveStatus={onSaveStatus} />);
    await waitFor(() => expect(saveButton()).toBeNull());
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommunicationBlock from './CommunicationBlock';
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

function input() {
  return screen.getByLabelText('Контакт для связи') as HTMLInputElement;
}

describe('CommunicationBlock', () => {
  it('показывает текущий контакт и не показывает Save', () => {
    render(<CommunicationBlock store={makeStore({ supportHandle: 'john' })} suggestedUsername="" onSave={vi.fn()} />);
    expect(input()).toHaveValue('john');
    expect(saveButton()).toBeNull();
  });

  it('нормализует @username на blur и сохраняет чистый username', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CommunicationBlock store={makeStore()} suggestedUsername="" onSave={onSave} />);

    await user.type(input(), '@john');
    await user.tab();

    expect(input()).toHaveValue('john');
    await user.click(saveButton() as HTMLElement);
    expect(onSave).toHaveBeenCalledWith({ supportHandle: 'john' });
  });

  it('нормализует ссылку t.me на blur', async () => {
    const user = userEvent.setup();
    render(<CommunicationBlock store={makeStore()} suggestedUsername="" onSave={vi.fn()} />);

    await user.type(input(), 'https://t.me/john');
    await user.tab();

    expect(input()).toHaveValue('john');
  });

  it('показывает ошибку на некорректный ввод и не даёт сохранить', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CommunicationBlock store={makeStore()} suggestedUsername="" onSave={onSave} />);

    await user.type(input(), 'https://google.com');
    await user.tab();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toBeNull());
  });

  it('очистка контакта сохраняет пустое значение', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CommunicationBlock store={makeStore({ supportHandle: 'john' })} suggestedUsername="" onSave={onSave} />);

    await user.clear(input());
    await user.tab();
    await user.click(saveButton() as HTMLElement);

    expect(onSave).toHaveBeenCalledWith({ supportHandle: '' });
  });

  it('подставляет мой username по кнопке', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CommunicationBlock store={makeStore()} suggestedUsername="sellerpro" onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Подставить мой @sellerpro' }));
    expect(input()).toHaveValue('sellerpro');
    await user.click(saveButton() as HTMLElement);
    expect(onSave).toHaveBeenCalledWith({ supportHandle: 'sellerpro' });
  });

  it('кнопка подстановки недоступна без username', () => {
    render(<CommunicationBlock store={makeStore()} suggestedUsername="" onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Подставить мой @username' })).toBeDisabled();
  });

  it('показывает кликабельную ссылку для проверки контакта', async () => {
    const user = userEvent.setup();
    render(<CommunicationBlock store={makeStore()} suggestedUsername="" onSave={vi.fn()} />);

    await user.type(input(), '@john');

    const link = screen.getByRole('link', { name: 'Открыть контакт в Telegram' });
    expect(link).toHaveAttribute('href', 'https://t.me/john');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('при ошибке сохраняет draft и показывает сообщение', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('FORBIDDEN'));
    render(<CommunicationBlock store={makeStore()} suggestedUsername="" onSave={onSave} />);

    await user.type(input(), '@john');
    await user.tab();
    await user.click(saveButton() as HTMLElement);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('FORBIDDEN'));
    expect(input()).toHaveValue('john');
  });

  it('крестик очищает поле и позволяет удалить контакт', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CommunicationBlock
        store={makeStore({ supportHandle: 'john' })}
        suggestedUsername=""
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Очистить контакт' }));
    expect(input()).toHaveValue('');

    await user.click(saveButton() as HTMLElement);
    expect(onSave).toHaveBeenCalledWith({ supportHandle: '' });
  });

  it('копирует ссылку контакта', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(
      <CommunicationBlock
        store={makeStore({ supportHandle: 'john' })}
        suggestedUsername=""
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Копировать контакт' }));

    expect(writeText).toHaveBeenCalledWith('https://t.me/john');
  });

  it('не показывает Save, если значение не изменилось', async () => {
    const user = userEvent.setup();
    render(<CommunicationBlock store={makeStore({ supportHandle: 'john' })} suggestedUsername="" onSave={vi.fn()} />);

    await user.clear(input());
    await user.type(input(), '@john');
    await user.tab();

    expect(input()).toHaveValue('john');
    await waitFor(() => expect(saveButton()).toBeNull());
  });
});

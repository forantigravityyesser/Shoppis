// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LocalizationBlock from './LocalizationBlock';
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

describe('LocalizationBlock', () => {
  it('показывает текущие валюту и язык без Save', () => {
    render(<LocalizationBlock store={makeStore()} onSave={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /USD/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Русский' })).toBeChecked();
    expect(saveButton()).toBeNull();
  });

  it('сохраняет только валюту при её изменении', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LocalizationBlock store={makeStore()} onSave={onSave} />);

    await user.click(screen.getByRole('radio', { name: /RUB/ }));
    expect(saveButton()).toBeInTheDocument();
    await user.click(saveButton() as HTMLElement);

    expect(onSave).toHaveBeenCalledWith({ currency: 'RUB' });
  });

  it('сохраняет только язык при его изменении', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LocalizationBlock store={makeStore()} onSave={onSave} />);

    await user.click(screen.getByRole('radio', { name: 'English' }));
    await user.click(saveButton() as HTMLElement);

    expect(onSave).toHaveBeenCalledWith({ language: 'en' });
  });

  it('при изменении обоих полей отправляет оба', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LocalizationBlock store={makeStore()} onSave={onSave} />);

    await user.click(screen.getByRole('radio', { name: /BYN/ }));
    await user.click(screen.getByRole('radio', { name: 'English' }));
    await user.click(saveButton() as HTMLElement);

    expect(onSave).toHaveBeenCalledWith({ currency: 'BYN', language: 'en' });
  });

  it('исчезает Save при возврате к исходным значениям', async () => {
    const user = userEvent.setup();
    render(<LocalizationBlock store={makeStore()} onSave={vi.fn()} />);

    await user.click(screen.getByRole('radio', { name: /RUB/ }));
    expect(saveButton()).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /USD/ }));
    await waitFor(() => expect(saveButton()).toBeNull());
  });

  it('при ошибке сохраняет draft и показывает сообщение', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('FORBIDDEN'));
    render(<LocalizationBlock store={makeStore()} onSave={onSave} />);

    await user.click(screen.getByRole('radio', { name: /RUB/ }));
    await user.click(saveButton() as HTMLElement);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('FORBIDDEN'));
    expect(screen.getByRole('radio', { name: /RUB/ })).toBeChecked();
    expect(saveButton()).toBeInTheDocument();
  });

  it('не дублирует сохранение при повторном клике', async () => {
    const user = userEvent.setup();
    let resolveSave: () => void = () => {};
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<LocalizationBlock store={makeStore()} onSave={onSave} />);

    await user.click(screen.getByRole('radio', { name: /RUB/ }));
    const button = saveButton() as HTMLElement;
    await user.click(button);
    await user.click(button);

    expect(onSave).toHaveBeenCalledTimes(1);
    resolveSave();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StoreIdentityBlock from './StoreIdentityBlock';
import type { Store } from '../../../domain/models/store';

// Кроппер — отдельный UI; здесь проверяем интеграцию блока, поэтому заменяем
// его на заглушку, которая прозрачно отдаёт выбранный файл через onConfirm.
vi.mock('../../shared/components/ImageCropSheet', () => ({
  default: ({
    open,
    file,
    onConfirm,
    onClose,
  }: {
    open: boolean;
    file: File | null;
    onConfirm: (file: File) => void;
    onClose: () => void;
  }) =>
    open && file ? (
      <>
        <button type="button" onClick={() => onConfirm(file)}>
          Готово
        </button>
        <button type="button" onClick={onClose}>
          Отмена
        </button>
      </>
    ) : null,
}));

function makeStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 's1',
    ownerUserId: 'u1',
    ownerTelegramId: 'tg1',
    name: 'Old Name',
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
    tutorialWelcomeDecision: 'unknown',
    tutorialStatus: 'not_started',
    tutorialStep: null,
    tutorialUpdatedAt: null,
    ...overrides,
  };
}

function saveButton() {
  return screen.queryByRole('button', { name: 'Сохранить' });
}

describe('StoreIdentityBlock', () => {
  it('показывает начальные значения и не показывает Save', () => {
    render(
      <StoreIdentityBlock store={makeStore()} onSave={vi.fn()} onUploadBanner={vi.fn()} />,
    );

    expect(screen.getByLabelText('Название магазина')).toHaveValue('Old Name');
    expect(screen.getByLabelText('Описание магазина')).toHaveValue('');
    expect(saveButton()).toBeNull();
  });

  it('появляется Save при изменении названия и исчезает при возврате', async () => {
    const user = userEvent.setup();
    render(
      <StoreIdentityBlock store={makeStore()} onSave={vi.fn()} onUploadBanner={vi.fn()} />,
    );
    const input = screen.getByLabelText('Название магазина');

    await user.clear(input);
    await user.type(input, 'New Name');
    expect(saveButton()).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'Old Name');
    await waitFor(() => expect(saveButton()).toBeNull());
  });

  it('сохраняет только изменённое поле name', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<StoreIdentityBlock store={makeStore()} onSave={onSave} onUploadBanner={vi.fn()} />);

    const input = screen.getByLabelText('Название магазина');
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(saveButton() as HTMLElement);

    expect(onSave).toHaveBeenCalledWith({ name: 'New Name' });
  });

  it('сохраняет только изменённое описание (с обрезкой пробелов)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<StoreIdentityBlock store={makeStore()} onSave={onSave} onUploadBanner={vi.fn()} />);

    const textarea = screen.getByLabelText('Описание магазина');
    await user.type(textarea, '  Лучший магазин  ');
    expect(saveButton()).toBeInTheDocument();
    await user.click(saveButton() as HTMLElement);

    expect(onSave).toHaveBeenCalledWith({ description: 'Лучший магазин' });
  });

  it('показывает описания из store', () => {
    render(
      <StoreIdentityBlock
        store={makeStore({ description: 'Официальный магазин' })}
        onSave={vi.fn()}
        onUploadBanner={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Описание магазина')).toHaveValue('Официальный магазин');
  });

  it('загружает баннер и отправляет только bannerUrl', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onUploadBanner = vi.fn().mockResolvedValue('https://cdn/new.png');
    render(
      <StoreIdentityBlock store={makeStore()} onSave={onSave} onUploadBanner={onUploadBanner} />,
    );

    const file = new File(['x'], 'banner.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Добавить баннер'), file);
    await user.click(screen.getByRole('button', { name: 'Готово' }));
    await user.click(saveButton() as HTMLElement);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ bannerUrl: 'https://cdn/new.png' }));
    expect(onUploadBanner).toHaveBeenCalledWith(file);
  });

  it('после успешного сохранения блок становится чистым', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onUploadBanner = vi.fn();
    const { rerender } = render(
      <StoreIdentityBlock store={makeStore()} onSave={onSave} onUploadBanner={onUploadBanner} />,
    );

    const input = screen.getByLabelText('Название магазина');
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(saveButton() as HTMLElement);

    rerender(
      <StoreIdentityBlock
        store={makeStore({ name: 'New Name' })}
        onSave={onSave}
        onUploadBanner={onUploadBanner}
      />,
    );
    await waitFor(() => expect(saveButton()).toBeNull());
  });

  it('при ошибке сохраняет draft и показывает сообщение', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('FORBIDDEN'));
    render(<StoreIdentityBlock store={makeStore()} onSave={onSave} onUploadBanner={vi.fn()} />);

    const input = screen.getByLabelText('Название магазина');
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(saveButton() as HTMLElement);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('FORBIDDEN'));
    expect(input).toHaveValue('New Name');
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
    render(<StoreIdentityBlock store={makeStore()} onSave={onSave} onUploadBanner={vi.fn()} />);

    const input = screen.getByLabelText('Название магазина');
    await user.clear(input);
    await user.type(input, 'New Name');

    const button = saveButton() as HTMLElement;
    await user.click(button);
    await user.click(button);

    expect(onSave).toHaveBeenCalledTimes(1);
    resolveSave();
  });

  it('не сохраняет пустое название', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<StoreIdentityBlock store={makeStore()} onSave={onSave} onUploadBanner={vi.fn()} />);

    await user.clear(screen.getByLabelText('Название магазина'));
    await user.click(saveButton() as HTMLElement);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Название магазина обязательно');
  });
});

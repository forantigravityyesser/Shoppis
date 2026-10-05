// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { openTelegramLink } = vi.hoisted(() => ({ openTelegramLink: vi.fn() }));

vi.mock('../../../../../application/hooks/useOpenTelegramLink', () => ({
  useOpenTelegramLink: () => openTelegramLink,
}));

import StoreContactLink from './StoreContactLink';

beforeEach(() => {
  openTelegramLink.mockReset();
  openTelegramLink.mockReturnValue(true);
});

describe('StoreContactLink', () => {
  it('без контакта — сообщение, кнопки нет', () => {
    render(<StoreContactLink handle={null} />);
    expect(screen.getByText('Продавец не указал контакт для связи.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Связаться с продавцом/ })).not.toBeInTheDocument();
  });

  it('некорректный контакт трактуется как отсутствующий', () => {
    render(<StoreContactLink handle="bad name!" />);
    expect(screen.getByText('Продавец не указал контакт для связи.')).toBeInTheDocument();
  });

  it('нормализует и открывает t.me-ссылку', async () => {
    render(<StoreContactLink handle="@john_shop" storeName="Nike" />);
    await userEvent.click(screen.getByRole('button', { name: /Связаться с продавцом/ }));
    expect(openTelegramLink).toHaveBeenCalledWith('https://t.me/john_shop');
    expect(screen.getByText(/в «Nike»/)).toBeInTheDocument();
  });

  it('сбой открытия → inline-ошибка', async () => {
    openTelegramLink.mockReturnValue(false);
    render(<StoreContactLink handle="john" />);
    await userEvent.click(screen.getByRole('button', { name: /Связаться с продавцом/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось открыть контакт продавца.');
  });
});

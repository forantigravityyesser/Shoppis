// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SharePreviewBlock from './SharePreviewBlock';

const URL = 'https://t.me/buyer_bot/app?startapp=shop_abc';

describe('SharePreviewBlock', () => {
  it('показывает публичную ссылку на витрину', () => {
    render(<SharePreviewBlock url={URL} />);
    const link = screen.getByRole('link', { name: 'Открыть витрину' });
    expect(link).toHaveAttribute('href', URL);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('копирует ссылку и показывает подтверждение', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<SharePreviewBlock url={URL} />);

    await user.click(screen.getByRole('button', { name: 'Копировать ссылку' }));

    expect(writeText).toHaveBeenCalledWith(URL);
    await waitFor(() => expect(screen.getByText('Скопировано')).toBeInTheDocument());
  });

  it('предпросмотр недоступен до появления витрины', () => {
    render(<SharePreviewBlock url={URL} />);
    expect(screen.getByRole('button', { name: 'Предпросмотр магазина' })).toBeDisabled();
    expect(screen.getByText(/Предпросмотр станет доступен/)).toBeInTheDocument();
  });

  it('вызывает предпросмотр, когда он доступен', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    render(<SharePreviewBlock url={URL} previewEnabled onPreview={onPreview} />);

    await user.click(screen.getByRole('button', { name: 'Предпросмотр магазина' }));

    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('read-only: нет кнопки Сохранить', () => {
    render(<SharePreviewBlock url={URL} />);
    expect(screen.queryByRole('button', { name: 'Сохранить' })).toBeNull();
  });
});

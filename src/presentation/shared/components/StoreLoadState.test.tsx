// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StoreLoadState from './StoreLoadState';

describe('StoreLoadState (R4)', () => {
  it('loading → индикатор, контент скрыт', () => {
    render(
      <StoreLoadState loading error={null} notFound={false} onRetry={vi.fn()}>
        <div>content</div>
      </StoreLoadState>,
    );
    expect(screen.getByText('Загрузка магазина…')).toBeInTheDocument();
    expect(screen.queryByText('content')).toBeNull();
  });

  it('error → alert с повтором, onRetry вызывается', async () => {
    const onRetry = vi.fn();
    render(
      <StoreLoadState loading={false} error="boom" notFound={false} onRetry={onRetry}>
        <div>content</div>
      </StoreLoadState>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить магазин');
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('notFound → «магазин не найден», без ошибки', () => {
    render(
      <StoreLoadState loading={false} error={null} notFound onRetry={vi.fn()}>
        <div>content</div>
      </StoreLoadState>,
    );
    expect(screen.getByText('Магазин не найден')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('контент рендерится при готовом магазине', () => {
    render(
      <StoreLoadState loading={false} error={null} notFound={false} onRetry={vi.fn()}>
        <div>content</div>
      </StoreLoadState>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});

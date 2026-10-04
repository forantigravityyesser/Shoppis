// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewComposer from './ReviewComposer';

describe('ReviewComposer', () => {
  it('поле комментария скрыто, пока оценка не выбрана', () => {
    render(<ReviewComposer authorName="Алексей" onSubmit={vi.fn()} pending={false} error={null} />);
    expect(screen.queryByPlaceholderText('Комментарий (необязательно)')).toBeNull();
  });

  it('выбор оценки раскрывает комментарий; отправка передаёт rating и text', async () => {
    const onSubmit = vi.fn();
    render(<ReviewComposer authorName="Алексей" onSubmit={onSubmit} pending={false} error={null} />);

    await userEvent.click(screen.getByRole('button', { name: '5 из 5' }));
    const textarea = screen.getByPlaceholderText('Комментарий (необязательно)');
    await userEvent.type(textarea, 'Класс');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(onSubmit).toHaveBeenCalledWith(5, 'Класс');
  });

  it('показывает ошибку', () => {
    render(
      <ReviewComposer authorName="Алексей" onSubmit={vi.fn()} pending={false} error="Уже есть" />,
    );
    expect(screen.getByText('Уже есть')).toBeInTheDocument();
  });
});

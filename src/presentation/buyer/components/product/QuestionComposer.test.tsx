// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestionComposer from './QuestionComposer';

const onSubmit = vi.fn();

beforeEach(() => onSubmit.mockReset().mockResolvedValue(undefined));

describe('QuestionComposer', () => {
  it('свёрнут: только кнопка «Задать вопрос», без поля', () => {
    render(<QuestionComposer onSubmit={onSubmit} pending={false} error={null} />);
    expect(screen.getByRole('button', { name: 'Задать вопрос' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Ваш вопрос')).toBeNull();
  });

  it('по нажатию раскрывается поле ввода', async () => {
    render(<QuestionComposer onSubmit={onSubmit} pending={false} error={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Задать вопрос' }));
    expect(screen.getByPlaceholderText('Ваш вопрос')).toBeInTheDocument();
  });

  it('отправка тримит текст', async () => {
    render(<QuestionComposer onSubmit={onSubmit} pending={false} error={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Задать вопрос' }));
    await userEvent.type(screen.getByPlaceholderText('Ваш вопрос'), '  Какой материал?  ');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(onSubmit).toHaveBeenCalledWith('Какой материал?');
  });

  it('пустой текст не отправляется', async () => {
    render(<QuestionComposer onSubmit={onSubmit} pending={false} error={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Задать вопрос' }));
    await userEvent.type(screen.getByPlaceholderText('Ваш вопрос'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('«Отмена» сворачивает форму', async () => {
    render(<QuestionComposer onSubmit={onSubmit} pending={false} error={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Задать вопрос' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.getByRole('button', { name: 'Задать вопрос' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Ваш вопрос')).toBeNull();
  });
});

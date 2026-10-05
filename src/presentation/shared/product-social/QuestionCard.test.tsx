// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StorefrontProductQuestion } from '../../../application/read-models/storefront-product';
import QuestionCard from './QuestionCard';

const question: StorefrontProductQuestion = {
  id: 'q1',
  authorName: 'Мария',
  text: 'Какой материал верха?',
  createdAt: '2026-10-01T00:00:00.000Z',
  isOwn: false,
  answer: { text: '100% хлопок', createdAt: '2026-10-02T00:00:00.000Z' },
};

describe('QuestionCard', () => {
  it('отвеченный вопрос → автор, текст, статус «Отвечен», ответ продавца', () => {
    render(<QuestionCard question={question} />);

    expect(screen.getByTestId('question-card')).toBeInTheDocument();
    expect(screen.getByText('Мария')).toBeInTheDocument();
    expect(screen.getByText('Какой материал верха?')).toBeInTheDocument();
    expect(screen.getByText('Отвечен')).toBeInTheDocument();
    expect(screen.getByText('Продавец')).toBeInTheDocument();
    expect(screen.getByText('100% хлопок')).toBeInTheDocument();
  });

  it('без ответа → статус «Без ответа», блока ответа нет', () => {
    const { container } = render(<QuestionCard question={{ ...question, answer: null }} />);

    expect(screen.getByText('Без ответа')).toBeInTheDocument();
    expect(container.querySelector('.pd-question__answer')).toBeNull();
  });

  it('свой вопрос → бейдж «Ваш вопрос»', () => {
    render(<QuestionCard question={{ ...question, isOwn: true }} />);
    expect(screen.getByText('Ваш вопрос')).toBeInTheDocument();
  });
});

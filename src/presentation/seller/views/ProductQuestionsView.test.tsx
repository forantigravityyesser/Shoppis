// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';

const { questionsState, refresh, createQuestion, hideQuestion, answerQuestion, errorRef } =
  vi.hoisted(() => ({
    questionsState: { current: {} as Record<string, unknown> },
    refresh: vi.fn(),
    createQuestion: vi.fn(),
    hideQuestion: vi.fn(),
    answerQuestion: vi.fn(),
    errorRef: { current: null as string | null },
  }));

vi.mock('../../../application/store', () => ({
  useStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      currentStore: { publicId: 'pub1' },
      serverUser: { id: 'seller1' },
    }),
}));

vi.mock('../../../application/hooks/useStorefrontProduct', () => ({
  useStorefrontProductQuestions: () => questionsState.current,
}));

vi.mock('../../../application/hooks/useQuestionActions', () => ({
  useQuestionActions: () => ({
    createQuestion,
    hideQuestion,
    answerQuestion,
    pending: false,
    error: errorRef.current,
  }),
}));

vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({
    impactLight: vi.fn(),
    impactMedium: vi.fn(),
    notifySuccess: vi.fn(),
    selectTick: vi.fn(),
  }),
}));

import ProductQuestionsView from './ProductQuestionsView';

const question = {
  id: 'q1',
  authorName: 'Мария',
  text: 'Какой материал верха?',
  createdAt: '2026-10-01T00:00:00.000Z',
  isOwn: false,
  answer: null as { text: string; createdAt: string } | null,
};

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/seller/inventory/product/p1/questions']}>
      <Routes>
        <Route
          path="/seller/inventory/product/:productId/questions"
          element={<ProductQuestionsView />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  refresh.mockReset();
  createQuestion.mockReset();
  hideQuestion.mockReset().mockResolvedValue(undefined);
  answerQuestion.mockReset().mockResolvedValue(undefined);
  errorRef.current = null;
  questionsState.current = {
    questions: [],
    viewerQuestion: null,
    canAsk: true,
    loading: false,
    error: null,
    refresh,
  };
});

describe('seller ProductQuestionsView', () => {
  it('loading → «Загрузка…»', () => {
    questionsState.current = { ...questionsState.current, loading: true };
    renderTab();
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });

  it('пусто → «Пока нет вопросов», без композера', () => {
    renderTab();
    expect(screen.getByTestId('seller-product-questions')).toBeInTheDocument();
    expect(screen.getByText('Пока нет вопросов')).toBeInTheDocument();
    expect(screen.queryByTestId('question-composer')).toBeNull();
  });

  it('ответ продавца → answerQuestion', async () => {
    questionsState.current = { ...questionsState.current, questions: [question] };
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Ответить' }));
    await userEvent.type(screen.getByPlaceholderText('Ответ покупателю'), '100% хлопок');
    await userEvent.click(screen.getByRole('button', { name: 'Ответить' }));

    expect(answerQuestion).toHaveBeenCalledWith('q1', '100% хлопок');
  });

  it('при открытой форме ответа «Удалить вопрос» скрыта', async () => {
    questionsState.current = { ...questionsState.current, questions: [question] };
    renderTab();

    expect(screen.getByRole('button', { name: 'Удалить вопрос' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ответить' }));
    expect(screen.getByPlaceholderText('Ответ покупателю')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить вопрос' })).toBeNull();
  });

  it('удаление вопроса продавцом → hideQuestion', async () => {
    questionsState.current = { ...questionsState.current, questions: [question] };
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить вопрос' }));
    expect(hideQuestion).toHaveBeenCalledWith('q1');
  });

  it('если уже есть ответ — кнопки «Ответить» нет, ответ помечен', () => {
    questionsState.current = {
      ...questionsState.current,
      questions: [
        { ...question, answer: { text: '100% хлопок', createdAt: '2026-10-02T00:00:00.000Z' } },
      ],
    };
    renderTab();
    expect(screen.queryByRole('button', { name: 'Ответить' })).toBeNull();
    expect(screen.getByText('Отвечен')).toBeInTheDocument();
    expect(screen.getByText('Продавец')).toBeInTheDocument();
    expect(screen.getByText('100% хлопок')).toBeInTheDocument();
  });

  it('ошибка → сообщение и повтор', async () => {
    questionsState.current = { ...questionsState.current, error: 'boom' };
    renderTab();

    expect(screen.getByText('Не удалось загрузить вопросы.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

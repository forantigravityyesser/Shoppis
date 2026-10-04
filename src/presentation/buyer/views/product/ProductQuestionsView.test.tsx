// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';

const { questionsState, refresh, createQuestion, hideQuestion, answerQuestion, actionsErrorRef } =
  vi.hoisted(() => ({
    questionsState: { current: {} as Record<string, unknown> },
    refresh: vi.fn(),
    createQuestion: vi.fn(),
    hideQuestion: vi.fn(),
    answerQuestion: vi.fn(),
    actionsErrorRef: { current: null as string | null },
  }));

vi.mock('../../../../application/store', () => ({
  useStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      viewedStore: { publicId: 'pub1' },
      serverUser: { id: 'u1', firstName: 'Алексей' },
    }),
}));

vi.mock('../../../../application/hooks/useStorefrontProduct', () => ({
  useStorefrontProductQuestions: () => questionsState.current,
}));

vi.mock('../../../../application/hooks/useQuestionActions', () => ({
  useQuestionActions: () => ({
    createQuestion,
    hideQuestion,
    answerQuestion,
    pending: false,
    error: actionsErrorRef.current,
  }),
}));

vi.mock('../../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({
    impactLight: vi.fn(),
    impactMedium: vi.fn(),
    notifySuccess: vi.fn(),
    selectTick: vi.fn(),
  }),
}));

import ProductQuestionsView from './ProductQuestionsView';

const otherQuestion = {
  id: 'q1',
  authorName: 'Мария',
  text: 'Какой материал верха?',
  createdAt: '2026-10-01T00:00:00.000Z',
  isOwn: false,
  answer: null as { text: string; createdAt: string } | null,
};

function renderQuestions() {
  return render(
    <MemoryRouter initialEntries={['/product/p1/questions']}>
      <Routes>
        <Route path="/product/:id/questions" element={<ProductQuestionsView />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  refresh.mockReset();
  createQuestion.mockReset().mockResolvedValue(undefined);
  hideQuestion.mockReset().mockResolvedValue(undefined);
  answerQuestion.mockReset().mockResolvedValue(undefined);
  actionsErrorRef.current = null;
  questionsState.current = {
    questions: [],
    viewerQuestion: null,
    canAsk: true,
    loading: false,
    error: null,
    refresh,
  };
});

describe('buyer ProductQuestionsView', () => {
  it('loading → «Загрузка…»', () => {
    questionsState.current = { ...questionsState.current, loading: true };
    renderQuestions();
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });

  it('пусто и canAsk=true → кнопка «Задать вопрос» + «Пока нет вопросов»', () => {
    renderQuestions();
    expect(screen.getByTestId('product-questions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Задать вопрос' })).toBeInTheDocument();
    expect(screen.getByText('Пока нет вопросов')).toBeInTheDocument();
  });

  it('canAsk=false → вместо композера уведомление', () => {
    questionsState.current = { ...questionsState.current, canAsk: false };
    renderQuestions();
    expect(screen.queryByTestId('question-composer')).toBeNull();
    expect(screen.getByText(/Вы уже задавали вопрос/)).toBeInTheDocument();
  });

  it('создание вопроса → createQuestion', async () => {
    renderQuestions();
    await userEvent.click(screen.getByRole('button', { name: 'Задать вопрос' }));
    await userEvent.type(screen.getByPlaceholderText('Ваш вопрос'), 'Есть ли размер L?');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(createQuestion).toHaveBeenCalledWith('Есть ли размер L?');
  });

  it('свой вопрос → «Удалить вопрос» вызывает hideQuestion', async () => {
    questionsState.current = {
      ...questionsState.current,
      canAsk: false,
      questions: [{ ...otherQuestion, isOwn: true, authorName: 'Вы' }],
    };
    renderQuestions();
    await userEvent.click(screen.getByRole('button', { name: 'Удалить вопрос' }));
    expect(hideQuestion).toHaveBeenCalledWith('q1');
  });

  it('чужой вопрос без ответа → статус «Без ответа», нет кнопки удаления', () => {
    questionsState.current = {
      ...questionsState.current,
      canAsk: false,
      questions: [otherQuestion],
    };
    renderQuestions();
    expect(screen.getByText('Без ответа')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить вопрос' })).toBeNull();
  });

  it('ошибка загрузки → сообщение и повтор', async () => {
    questionsState.current = { ...questionsState.current, error: 'boom' };
    renderQuestions();

    expect(screen.getByText('Не удалось загрузить вопросы.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

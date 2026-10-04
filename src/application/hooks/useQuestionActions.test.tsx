// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import type { ReactNode } from 'react';

const { createQuestion, hideQuestion, answerQuestion, sessionRef } = vi.hoisted(() => ({
  createQuestion: vi.fn(),
  hideQuestion: vi.fn(),
  answerQuestion: vi.fn(),
  sessionRef: { current: 'tok' as string | null },
}));

vi.mock('../composition/container', () => ({
  deps: () => ({ questionApi: { createQuestion, hideQuestion, answerQuestion } }),
}));

vi.mock('../store', () => ({
  useStore: (selector: (state: { sessionToken: string | null }) => unknown) =>
    selector({ sessionToken: sessionRef.current }),
}));

import { useQuestionActions } from './useQuestionActions';

let client: QueryClient;

beforeEach(() => {
  createQuestion.mockReset().mockResolvedValue(undefined);
  hideQuestion.mockReset().mockResolvedValue(undefined);
  answerQuestion.mockReset().mockResolvedValue(undefined);
  sessionRef.current = 'tok';
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useQuestionActions', () => {
  it('createQuestion вызывает api с токеном, товаром и текстом + инвалидирует', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useQuestionActions('pub1', 'p1'), { wrapper });

    await act(async () => {
      await result.current.createQuestion('Какой материал?');
    });

    expect(createQuestion).toHaveBeenCalledWith('tok', 'p1', 'Какой материал?');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['storefront-product-questions', 'pub1', 'p1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['storefront-product', 'pub1', 'p1'] });
  });

  it('hideQuestion / answerQuestion → api', async () => {
    const { result } = renderHook(() => useQuestionActions('pub1', 'p1'), { wrapper });

    await act(async () => {
      await result.current.hideQuestion('q1');
      await result.current.answerQuestion('q1', 'Хлопок');
    });

    expect(hideQuestion).toHaveBeenCalledWith('tok', 'q1');
    expect(answerQuestion).toHaveBeenCalledWith('tok', 'q1', 'Хлопок');
  });

  it('без сессии → UNAUTHORIZED, api не вызывается', async () => {
    sessionRef.current = null;
    const { result } = renderHook(() => useQuestionActions('pub1', 'p1'), { wrapper });

    await expect(result.current.createQuestion('x')).rejects.toThrow('UNAUTHORIZED');
    expect(createQuestion).not.toHaveBeenCalled();
  });

  it('ошибка api попадает в error', async () => {
    createQuestion.mockRejectedValue(new Error('ALREADY_ASKED'));
    const { result } = renderHook(() => useQuestionActions('pub1', 'p1'), { wrapper });

    await expect(result.current.createQuestion('x')).rejects.toThrow('ALREADY_ASKED');
    await waitFor(() => expect(result.current.error).toBe('ALREADY_ASKED'));
  });
});

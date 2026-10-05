import { describe, it, expect, vi, beforeEach } from 'vitest';

const { invokeFunction } = vi.hoisted(() => ({ invokeFunction: vi.fn() }));

vi.mock('../insforge/functions-gateway', () => ({ invokeFunction }));

import { answerQuestion, createQuestion, hideQuestion, loadSellerQuestions } from './question-api';

beforeEach(() => invokeFunction.mockReset());

describe('question-api', () => {
  it('createQuestion → question-actions с action и payload', async () => {
    invokeFunction.mockResolvedValue({ data: { success: true }, error: null });

    await createQuestion('tok', 'p1', 'Какой материал верха?');

    expect(invokeFunction).toHaveBeenCalledWith('question-actions', {
      token: 'tok',
      body: { action: 'question-create', productId: 'p1', text: 'Какой материал верха?' },
    });
  });

  it('hideQuestion / answerQuestion → корректные action', async () => {
    invokeFunction.mockResolvedValue({ data: { success: true }, error: null });

    await hideQuestion('tok', 'q1');
    expect(invokeFunction).toHaveBeenCalledWith('question-actions', {
      token: 'tok',
      body: { action: 'question-hide', questionId: 'q1' },
    });

    await answerQuestion('tok', 'q1', 'Хлопок');
    expect(invokeFunction).toHaveBeenCalledWith('question-actions', {
      token: 'tok',
      body: { action: 'question-answer', questionId: 'q1', text: 'Хлопок' },
    });
  });

  it('loadSellerQuestions → question-seller-read и возвращает result', async () => {
    const projection = { questions: [], canAsk: true };
    invokeFunction.mockResolvedValue({ data: { success: true, result: projection }, error: null });

    const result = await loadSellerQuestions('tok', 'p1');

    expect(invokeFunction).toHaveBeenCalledWith('question-actions', {
      token: 'tok',
      body: { action: 'question-seller-read', productId: 'p1' },
    });
    expect(result).toEqual(projection);
  });

  it('бросает код ошибки от edge', async () => {
    invokeFunction.mockResolvedValue({
      data: null,
      error: { message: 'ALREADY_ASKED', status: 409 },
    });
    await expect(createQuestion('tok', 'p1', '?')).rejects.toThrow('ALREADY_ASKED');
  });

  it('бросает, если success=false', async () => {
    invokeFunction.mockResolvedValue({ data: { success: false, error: 'FORBIDDEN' }, error: null });
    await expect(hideQuestion('tok', 'q1')).rejects.toThrow('FORBIDDEN');
  });
});

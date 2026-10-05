import { invokeFunction } from '../insforge/functions-gateway';

/**
 * Клиент edge-диспетчера question-actions. Мутации вопросов уходят на сервер,
 * где атомарно выполняются PL/pgSQL-функциями (migrations/0020) с actor из сессии.
 */
interface QuestionResponse {
  success?: boolean;
  result?: unknown;
  error?: string;
}

/** Общий вызов edge; возвращает payload чтения (`result`) для read-действий. */
async function callQuestionRaw(token: string, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await invokeFunction<QuestionResponse>('question-actions', { body, token });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Question action failed');
  return data.result;
}

async function callQuestion(token: string, body: Record<string, unknown>): Promise<void> {
  await callQuestionRaw(token, body);
}

export async function createQuestion(
  token: string,
  productId: string,
  text: string,
): Promise<void> {
  await callQuestion(token, { action: 'question-create', productId, text });
}

export async function hideQuestion(token: string, questionId: string): Promise<void> {
  await callQuestion(token, { action: 'question-hide', questionId });
}

export async function answerQuestion(
  token: string,
  questionId: string,
  text: string,
): Promise<void> {
  await callQuestion(token, { action: 'question-answer', questionId, text });
}

/** Seller-чтение вопросов (включая ARCHIVED); actor и owner-check — на сервере. */
export async function loadSellerQuestions(token: string, productId: string): Promise<unknown> {
  return callQuestionRaw(token, { action: 'question-seller-read', productId });
}

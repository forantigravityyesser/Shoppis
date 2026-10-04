import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store';
import { deps } from '../composition/container';

export interface QuestionActionsState {
  createQuestion: (text: string) => Promise<void>;
  hideQuestion: (questionId: string) => Promise<void>;
  answerQuestion: (questionId: string, text: string) => Promise<void>;
  pending: boolean;
  /** Код/сообщение последней ошибки мутации (напр. ALREADY_ASKED) или null. */
  error: string | null;
}

/**
 * Мутации вопросов (задать / удалить свой / ответить). Токен берём из сессии
 * (actor на сервере — только из неё). После успеха инвалидируем ленту вопросов
 * и карточку (questionsCount). docs/14 §9.
 */
export function useQuestionActions(
  publicId: string | null,
  productId: string | null,
): QuestionActionsState {
  const queryClient = useQueryClient();
  const sessionToken = useStore((s) => s.sessionToken);

  const invalidate = () => {
    if (publicId && productId) {
      void queryClient.invalidateQueries({
        queryKey: ['storefront-product-questions', publicId, productId],
      });
      void queryClient.invalidateQueries({ queryKey: ['storefront-product', publicId, productId] });
    }
  };

  const create = useMutation({
    mutationFn: (text: string) => {
      if (!sessionToken || !productId) return Promise.reject(new Error('UNAUTHORIZED'));
      return deps().questionApi.createQuestion(sessionToken, productId, text);
    },
    onSuccess: invalidate,
  });

  const hide = useMutation({
    mutationFn: (questionId: string) => {
      if (!sessionToken) return Promise.reject(new Error('UNAUTHORIZED'));
      return deps().questionApi.hideQuestion(sessionToken, questionId);
    },
    onSuccess: invalidate,
  });

  const answer = useMutation({
    mutationFn: (vars: { questionId: string; text: string }) => {
      if (!sessionToken) return Promise.reject(new Error('UNAUTHORIZED'));
      return deps().questionApi.answerQuestion(sessionToken, vars.questionId, vars.text);
    },
    onSuccess: invalidate,
  });

  const error = (create.error ?? hide.error ?? answer.error) as Error | null;

  return {
    createQuestion: (text) => create.mutateAsync(text).then(() => undefined),
    hideQuestion: (questionId) => hide.mutateAsync(questionId).then(() => undefined),
    answerQuestion: (questionId, text) =>
      answer.mutateAsync({ questionId, text }).then(() => undefined),
    pending: create.isPending || hide.isPending || answer.isPending,
    error: error ? error.message : null,
  };
}

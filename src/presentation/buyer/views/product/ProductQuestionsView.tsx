import { useParams } from 'react-router';
import { useStore } from '../../../../application/store';
import { useStorefrontProductQuestions } from '../../../../application/hooks/useStorefrontProduct';
import { useQuestionActions } from '../../../../application/hooks/useQuestionActions';
import { useHaptic } from '../../../../application/hooks/useHaptic';
import SocialLayer from '../../components/product/SocialLayer';
import QuestionCard from '../../components/product/QuestionCard';
import QuestionComposer from '../../components/product/QuestionComposer';
import { questionErrorMessage } from '../../../shared/question-error-message';

/**
 * Слой «Вопросы» (nested route `/product/:id/questions`).
 * PD-11a — чтение (список + статус ответа). PD-11c — запись покупателя: задать
 * вопрос (1 на товар), удалить свой. Отвечать покупатель не может. docs/14 §9.
 */
export default function ProductQuestionsView() {
  const { id } = useParams<{ id: string }>();
  const publicId = useStore((s) => s.viewedStore?.publicId ?? null);
  const viewerUserId = useStore((s) => s.serverUser?.id ?? null);

  const { questions, canAsk, loading, error, refresh } = useStorefrontProductQuestions(
    publicId,
    id ?? null,
    true,
    viewerUserId,
  );
  const actions = useQuestionActions(publicId, id ?? null);
  const { selectTick, notifySuccess } = useHaptic();

  const actionError = questionErrorMessage(actions.error);

  const handleCreate = async (text: string) => {
    try {
      await actions.createQuestion(text);
      notifySuccess();
    } catch {
      /* ошибка показана через actions.error → actionError */
    }
  };

  const handleDelete = async (questionId: string) => {
    try {
      await actions.hideQuestion(questionId);
      selectTick();
    } catch {
      /* см. actionError */
    }
  };

  return (
    <SocialLayer title="Вопросы" backTo={`/product/${id ?? ''}`}>
      <div className="pd-reviews pd-questions" data-testid="product-questions">
        {error ? (
          <div className="pd-reviews__state">
            <p>Не удалось загрузить вопросы.</p>
            <button type="button" className="pd-retry" onClick={refresh}>
              Повторить
            </button>
          </div>
        ) : loading ? (
          <div className="pd-reviews__state">Загрузка…</div>
        ) : (
          <>
            {canAsk ? (
              <QuestionComposer
                onSubmit={handleCreate}
                pending={actions.pending}
                error={actionError}
              />
            ) : (
              <p className="pd-reviews__notice">
                Вы уже задавали вопрос. Изменить или задать новый нельзя.
              </p>
            )}

            {questions.length > 0 ? (
              <div className="pd-reviews__list">
                {questions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    footer={
                      question.isOwn ? (
                        <button
                          type="button"
                          className="pd-review__action pd-review__action--danger"
                          disabled={actions.pending}
                          onClick={() => void handleDelete(question.id)}
                        >
                          Удалить вопрос
                        </button>
                      ) : null
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="pd-reviews__empty">Пока нет вопросов</p>
            )}
          </>
        )}
      </div>
    </SocialLayer>
  );
}

import { useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useSellerProductQuestions } from '../../../application/hooks/useSellerProductSocial';
import { useQuestionActions } from '../../../application/hooks/useQuestionActions';
import { useHaptic } from '../../../application/hooks/useHaptic';
import QuestionCard from '../../shared/product-social/QuestionCard';
import { questionErrorMessage } from '../../shared/question-error-message';
import '../../shared/product-social/product-social.css';

/**
 * Вкладка «Вопросы» seller-карточки (nested route `/seller/inventory/product/:productId/questions`).
 * Визуал один-в-один с покупательским (карточки + статус), но продавец не может
 * задавать вопросы — только **отвечать** (1 раз) и **удалять** любой вопрос своего
 * товара. Владелец видит вопросы и у архивных товаров. docs/14 §9 (PD-11c).
 */
export default function ProductQuestionsView() {
  const { t } = useTranslation();
  const { productId = '' } = useParams();
  const publicId = useStore((s) => s.currentStore?.publicId ?? null);

  const { questions, loading, error, refresh } = useSellerProductQuestions(productId || null);
  const actions = useQuestionActions(publicId, productId || null);
  const { notifySuccess, selectTick } = useHaptic();

  const [answerTo, setAnswerTo] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const actionError = questionErrorMessage(actions.error);

  const handleAnswer = async (questionId: string) => {
    try {
      await actions.answerQuestion(questionId, answerText);
      notifySuccess();
      setAnswerTo(null);
      setAnswerText('');
      refresh();
    } catch {
      /* ошибка показана через actionError */
    }
  };

  const handleDelete = async (questionId: string) => {
    try {
      await actions.hideQuestion(questionId);
      selectTick();
      refresh();
    } catch {
      /* ошибка показана через actionError */
    }
  };

  if (loading) {
    return (
      <div className="glass inv-state prod-tab-empty">
        <p className="inv-state__title">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass inv-state prod-tab-empty">
        <p className="inv-state__title">{t('seller.questions.loadError')}</p>
        <button type="button" className="pd-retry" onClick={refresh}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="pd-reviews seller-reviews" data-testid="seller-product-questions">
      {questions.length > 0 ? (
        <div className="pd-reviews__list">
          {questions.map((question) => {
            const answered = question.answer !== null;

            const deleteButton = (
              <button
                type="button"
                className="pd-review__action pd-review__action--danger"
                disabled={actions.pending}
                onClick={() => void handleDelete(question.id)}
              >
                {t('seller.questions.delete')}
              </button>
            );

            const footer =
              answerTo === question.id ? (
                <div className="pd-reply-form">
                  <textarea
                    className="pd-compose__input"
                    placeholder={t('seller.questions.answerPlaceholder')}
                    value={answerText}
                    maxLength={2000}
                    rows={2}
                    onChange={(event) => setAnswerText(event.target.value)}
                  />
                  <div className="pd-reply-form__actions">
                    {actionError ? <span className="pd-compose__error">{actionError}</span> : null}
                    <button
                      type="button"
                      className="pd-compose__submit"
                      disabled={actions.pending}
                      onClick={() => void handleAnswer(question.id)}
                    >
                      {t('seller.questions.answer')}
                    </button>
                    <button
                      type="button"
                      className="pd-review__action"
                      onClick={() => {
                        setAnswerTo(null);
                        setAnswerText('');
                      }}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {!answered ? (
                    <button
                      type="button"
                      className="pd-review__action"
                      onClick={() => {
                        setAnswerTo(question.id);
                        setAnswerText('');
                      }}
                    >
                      {t('seller.questions.answer')}
                    </button>
                  ) : null}
                  {deleteButton}
                </>
              );

            return <QuestionCard key={question.id} question={question} footer={footer} />;
          })}
        </div>
      ) : (
        <p className="pd-reviews__empty">{t('seller.questions.empty')}</p>
      )}
    </div>
  );
}

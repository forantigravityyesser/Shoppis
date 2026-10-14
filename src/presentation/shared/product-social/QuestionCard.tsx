import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { StorefrontProductQuestion } from '../../../application/read-models/storefront-product';
import { getInitial } from '../../../domain/rules/initial';
import { formatLongDate } from '../format-date';

interface Props {
  question: StorefrontProductQuestion;
  /** Действия под вопросом (ответить / удалить) — собираются вызывающим слоем. */
  footer?: ReactNode;
}

/**
 * Карточка вопроса: автор (инициал), статус («Без ответа» / «Отвечен»), дата,
 * текст, ответ продавца (если есть) и слот действий. docs/14 §9.
 */
export default function QuestionCard({ question, footer }: Props) {
  const { t } = useTranslation();
  const answered = question.answer !== null;
  return (
    <article className="pd-review pd-question" data-testid="question-card">
      <header className="pd-review__head">
        <span className="pd-review__avatar" aria-hidden>
          {getInitial(question.authorName)}
        </span>
        <div className="pd-review__who">
          <span className="pd-review__author">
            {question.authorName}
            {question.isOwn ? <span className="pd-review__own">{t('productSocial.yourQuestion')}</span> : null}
          </span>
          <span
            className={`pd-question__status ${
              answered ? 'pd-question__status--answered' : 'pd-question__status--unanswered'
            }`}
          >
            {answered ? t('productSocial.answered') : t('productSocial.unanswered')}
          </span>
        </div>
        <time className="pd-review__date">{formatLongDate(question.createdAt)}</time>
      </header>

      <p className="pd-review__text">{question.text}</p>

      {question.answer ? (
        <div className="pd-question__answer" data-testid="question-answer">
          <span className="pd-question__answer-badge">{t('productSocial.seller')}</span>
          <span className="pd-question__answer-text">{question.answer.text}</span>
        </div>
      ) : null}

      {footer ? <div className="pd-review__footer">{footer}</div> : null}
    </article>
  );
}

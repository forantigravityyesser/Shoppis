import type { ReactNode } from 'react';
import type { StorefrontProductQuestion } from '../../../application/read-models/storefront-product';
import { getInitial } from '../../../domain/rules/initial';

interface Props {
  question: StorefrontProductQuestion;
  /** Действия под вопросом (ответить / удалить) — собираются вызывающим слоем. */
  footer?: ReactNode;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Карточка вопроса: автор (инициал), статус («Без ответа» / «Отвечен»), дата,
 * текст, ответ продавца (если есть) и слот действий. docs/14 §9.
 */
export default function QuestionCard({ question, footer }: Props) {
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
            {question.isOwn ? <span className="pd-review__own">Ваш вопрос</span> : null}
          </span>
          <span
            className={`pd-question__status ${
              answered ? 'pd-question__status--answered' : 'pd-question__status--unanswered'
            }`}
          >
            {answered ? 'Отвечен' : 'Без ответа'}
          </span>
        </div>
        <time className="pd-review__date">{formatDate(question.createdAt)}</time>
      </header>

      <p className="pd-review__text">{question.text}</p>

      {question.answer ? (
        <div className="pd-question__answer" data-testid="question-answer">
          <span className="pd-question__answer-badge">Продавец</span>
          <span className="pd-question__answer-text">{question.answer.text}</span>
        </div>
      ) : null}

      {footer ? <div className="pd-review__footer">{footer}</div> : null}
    </article>
  );
}

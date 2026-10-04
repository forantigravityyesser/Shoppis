import { useState } from 'react';
import { getInitial } from '../../../../domain/rules/initial';
import StarInput from './StarInput';

interface Props {
  authorName: string;
  onSubmit: (rating: number, text: string) => void | Promise<void>;
  pending: boolean;
  error: string | null;
}

/**
 * Блок создания отзыва: аватар-инициал + выбор оценки; при выборе (rating > 0)
 * раскрывается поле комментария (необязательно) и «Отправить». docs/14 §8.
 */
export default function ReviewComposer({ authorName, onSubmit, pending, error }: Props) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  const submit = () => {
    if (!rating || pending) return;
    void onSubmit(rating, text);
  };

  return (
    <section className="pd-compose" data-testid="review-composer">
      <div className="pd-compose__head">
        <span className="pd-compose__avatar" aria-hidden>
          {getInitial(authorName)}
        </span>
        <div className="pd-compose__who">
          <span className="pd-compose__hint">Поставьте оценку</span>
          <StarInput value={rating} onChange={setRating} />
        </div>
      </div>

      {rating > 0 ? (
        <div className="pd-compose__body">
          <textarea
            className="pd-compose__input"
            placeholder="Комментарий (необязательно)"
            value={text}
            maxLength={2000}
            rows={3}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="pd-compose__actions">
            {error ? <span className="pd-compose__error">{error}</span> : null}
            <button type="button" className="pd-compose__submit" disabled={pending} onClick={submit}>
              {pending ? 'Отправка…' : 'Отправить'}
            </button>
          </div>
        </div>
      ) : error ? (
        <p className="pd-compose__error">{error}</p>
      ) : null}
    </section>
  );
}

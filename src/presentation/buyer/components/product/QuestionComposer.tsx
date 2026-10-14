import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onSubmit: (text: string) => void | Promise<void>;
  pending: boolean;
  error: string | null;
}

/**
 * Блок создания вопроса: свёрнут до кнопки «Задать вопрос»; по нажатию
 * раскрывается поле ввода + «Отправить»/«Отмена». Без оценки. docs/14 §9.
 */
export default function QuestionComposer({ onSubmit, pending, error }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const submit = () => {
    const value = text.trim();
    if (!value || pending) return;
    void onSubmit(value);
  };

  if (!open) {
    return (
      <div className="pd-questions__ask" data-testid="question-composer">
        <button type="button" className="pd-question__ask-btn" onClick={() => setOpen(true)}>
          {t('buyer.product.askQuestion')}
        </button>
      </div>
    );
  }

  return (
    <section className="pd-compose" data-testid="question-composer">
      <textarea
        className="pd-compose__input"
        placeholder={t('buyer.product.questionPlaceholder')}
        value={text}
        maxLength={2000}
        rows={3}
        autoFocus
        onChange={(event) => setText(event.target.value)}
      />
      <div className="pd-compose__actions">
        {error ? <span className="pd-compose__error">{error}</span> : null}
        <button type="button" className="pd-compose__submit" disabled={pending} onClick={submit}>
          {pending ? t('buyer.product.sending') : t('buyer.product.send')}
        </button>
        <button
          type="button"
          className="pd-review__action"
          onClick={() => {
            setOpen(false);
            setText('');
          }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </section>
  );
}

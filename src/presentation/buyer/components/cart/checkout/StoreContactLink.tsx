import { useState } from 'react';
import { Send } from 'lucide-react';
import { useOpenTelegramLink } from '../../../../../application/hooks/useOpenTelegramLink';
import { normalizeTelegramUsername } from '../../../../../domain/rules/store-contact-rules';

interface Props {
  /** Публичный контакт продавца из БД (`support_handle`); null — не задан. */
  handle: string | null;
  storeName?: string;
}

/**
 * Вторичное действие «Связаться с продавцом» в форме оформления (docs/18 §26).
 * Ссылка строится только из контакта, заданного продавцом в БД. Если контакт не
 * задан/некорректен — действие недоступно с понятным сообщением; при сбое открытия
 * показываем inline-ошибку (внешний Telegram-аккаунт может быть недоступен).
 */
export default function StoreContactLink({ handle, storeName }: Props) {
  const openTelegramLink = useOpenTelegramLink();
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeTelegramUsername(handle ?? '');
  const username = normalized.valid ? normalized.username : '';

  if (!username) {
    return (
      <div className="checkout-contact">
        <p className="checkout-contact__note" role="status">
          Продавец не указал контакт для связи.
        </p>
      </div>
    );
  }

  const handleClick = () => {
    setError(null);
    let opened: boolean;
    try {
      opened = openTelegramLink(`https://t.me/${username}`);
    } catch {
      opened = false;
    }
    if (!opened) setError('Не удалось открыть контакт продавца.');
  };

  return (
    <div className="checkout-contact">
      <p className="checkout-contact__hint">
        Есть вопросы по оформлению{storeName ? ` в «${storeName}»` : ''}?
      </p>
      <button type="button" className="checkout-contact__btn" onClick={handleClick}>
        <Send size={16} aria-hidden />
        Связаться с продавцом
      </button>
      {error ? (
        <p className="checkout-contact__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

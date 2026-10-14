import { useState } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const openTelegramLink = useOpenTelegramLink();
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeTelegramUsername(handle ?? '');
  const username = normalized.valid ? normalized.username : '';

  if (!username) {
    return (
      <div className="checkout-contact">
        <p className="checkout-contact__note" role="status">
          {t('buyer.checkout.contactNotSpecified')}
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
    if (!opened) setError(t('buyer.checkout.contactOpenFailed'));
  };

  return (
    <div className="checkout-contact">
      <p className="checkout-contact__hint">
        {storeName
          ? t('buyer.checkout.contactHintWithStore', { store: storeName })
          : t('buyer.checkout.contactHintNoStore')}
      </p>
      <button type="button" className="checkout-contact__btn" onClick={handleClick}>
        <Send size={16} aria-hidden />
        {t('buyer.checkout.contactCta')}
      </button>
      {error ? (
        <p className="checkout-contact__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

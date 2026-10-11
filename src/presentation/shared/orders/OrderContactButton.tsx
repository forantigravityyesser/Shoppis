import { useState, type ReactNode } from 'react';
import { Send } from 'lucide-react';
import { useOpenTelegramLink } from '../../../application/hooks/useOpenTelegramLink';
import { normalizeTelegramUsername } from '../../../domain/rules/store-contact-rules';

interface Props {
  /** Telegram-username контакта (buyer → support_handle; seller → TG-снимок покупателя). */
  username: string | null;
  label?: string;
  /** Текст, если контакт не задан/некорректен (когда `fallback` не передан). */
  fallbackText?: string;
  /** Произвольный fallback (например, телефон из delivery) вместо текста. */
  fallback?: ReactNode;
}

/**
 * Контакт по заказу (docs/22 §5.4). Данные-driven: принимает username и
 * открывает `https://t.me/<username>` через порт. Actor-различия (какой контакт
 * передать) решает тонкий view, компонент не знает про buyer/seller.
 */
export default function OrderContactButton({
  username,
  label = 'Связаться',
  fallbackText = 'Контакт не указан.',
  fallback,
}: Props) {
  const openTelegramLink = useOpenTelegramLink();
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeTelegramUsername(username ?? '');
  const handle = normalized.valid ? normalized.username : '';

  if (!handle) {
    return (
      <div className="order-contact" data-testid="order-contact-fallback">
        {fallback ?? (
          <p className="order-contact__note" role="status">
            {fallbackText}
          </p>
        )}
      </div>
    );
  }

  const handleClick = () => {
    setError(null);
    let opened: boolean;
    try {
      opened = openTelegramLink(`https://t.me/${handle}`);
    } catch {
      opened = false;
    }
    if (!opened) setError('Не удалось открыть контакт.');
  };

  return (
    <div className="order-contact">
      <button
        type="button"
        className="order-contact__btn"
        onClick={handleClick}
        data-testid="order-contact-btn"
      >
        <Send size={16} aria-hidden />
        {label}
      </button>
      {error ? (
        <p className="order-contact__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

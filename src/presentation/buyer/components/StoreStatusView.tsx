import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getInitial } from '../../../domain/rules/initial';
import SafeImage from '../../shared/components/SafeImage';

interface Props {
  variant: 'notFound' | 'paused';
  /** Название магазина для брендовой шапки на паузе. docs/13 §15. */
  storeName?: string;
  /** Публичный логотип магазина; null → инициал названия. docs/15 §3.4. */
  logoUrl?: string | null;
  /** Контакт продавца (только для pause); null/undefined → кнопка не рендерится. */
  supportHandle?: string | null;
}

/**
 * Состояния витрины: магазин не найден / на паузе.
 * На паузе покупка недоступна (добавление в корзину/оформление), но фирменный
 * визуал (аватар + название) сохраняется. Существующие заказы не затрагиваются. docs/13 §15.
 */
export default function StoreStatusView({
  variant,
  storeName,
  logoUrl,
  supportHandle,
}: Props) {
  const { t } = useTranslation();
  if (variant === 'notFound') {
    return (
      <div className="store-status">
        <div className="store-status__icon" aria-hidden>
          🔍
        </div>
        <h1 className="store-status__title">{t('buyer.storeStatus.notFoundTitle')}</h1>
        <p className="store-status__text">{t('buyer.storeStatus.notFoundText')}</p>
      </div>
    );
  }

  return (
    <div className="store-status">
      {storeName ? (
        <div className="store-status__brand">
          <SafeImage
            src={logoUrl ?? null}
            alt=""
            className="store-status__avatar"
            fallback={
              <span className="store-status__avatar store-status__avatar--initial" aria-hidden>
                {getInitial(storeName)}
              </span>
            }
          />
          <span className="store-status__name">{storeName}</span>
        </div>
      ) : null}

      <div className="store-status__icon" aria-hidden>
        ⏸️
      </div>
      <h1 className="store-status__title">{t('buyer.storeStatus.pausedTitle')}</h1>
      <p className="store-status__text">{t('buyer.storeStatus.pausedText')}</p>
      {supportHandle ? <ContactButton handle={supportHandle} /> : null}
    </div>
  );
}

function ContactButton({ handle }: { handle: string }) {
  const { t } = useTranslation();
  return (
    <a
      className="store-status__contact"
      href={`https://t.me/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('buyer.storeStatus.contact')}
    >
      <Send size={16} />
      {t('buyer.storeStatus.contact')}
    </a>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RefusalReasonCode } from '../../../domain/models/order';
import { REFUSAL_REASON_META } from '../../../domain/constants/order-statuses';

const CODES: RefusalReasonCode[] = [
  'BUYER_CHANGED_MIND',
  'COULD_NOT_CONTACT_BUYER',
  'DELIVERY_TERMS',
  'PRODUCT_NOT_MATCHED_EXPECTATIONS',
  'OTHER',
];

interface Props {
  pending?: boolean;
  error?: string | null;
  /** Причина обязательна (docs/22 §5.8) — confirm disabled до выбора. */
  onConfirm: (reason: RefusalReasonCode) => void;
  onCancel: () => void;
}

/**
 * Выбор контролируемой причины отказа (docs/22 §5.2/§5.8). Данные-driven:
 * коды и RU-подписи из домена; компонент не знает про мутацию. Только seller-поток.
 */
export default function OrderRefusalPicker({ pending = false, error, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<RefusalReasonCode | null>(null);

  return (
    <div className="order-confirm" role="group" aria-label={t('orders.refusal.aria')} aria-busy={pending}>
      <p className="order-confirm__text">{t('orders.refusal.title')}</p>
      <ul className="order-refuse">
        {CODES.map((code) => (
          <li key={code}>
            <label
              className={`order-refuse__option${reason === code ? ' order-refuse__option--active' : ''}`}
            >
              <input
                type="radio"
                name="refusal-reason"
                value={code}
                checked={reason === code}
                disabled={pending}
                onChange={() => setReason(code)}
              />
              <span className="order-refuse__label">{t(REFUSAL_REASON_META[code].labelKey)}</span>
            </label>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="order-confirm__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="order-confirm__actions">
        <button
          type="button"
          className="order-confirm__cancel"
          onClick={onCancel}
          disabled={pending}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="order-confirm__danger"
          onClick={() => reason && onConfirm(reason)}
          disabled={pending || !reason}
        >
          {t('orders.refusal.confirm')}
        </button>
      </div>
    </div>
  );
}

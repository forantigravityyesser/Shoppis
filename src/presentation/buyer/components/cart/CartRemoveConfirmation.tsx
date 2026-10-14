import { useTranslation } from 'react-i18next';

interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Inline-подтверждение удаления позиции (docs/18 §19). «Нет» закрывает,
 * «Да» удаляет ровно эту позицию. Одновременно подтверждение открыто
 * только у одного товара — состояние держит `CartView` (`pendingRemoveItemKey`).
 */
export default function CartRemoveConfirmation({ onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <div className="cart-remove-confirm" role="group" aria-label={t('buyer.cart.remove.aria')}>
      <p className="cart-remove-confirm__text">{t('buyer.cart.remove.text')}</p>
      <div className="cart-remove-confirm__actions">
        <button type="button" className="cart-remove-confirm__cancel" onClick={onCancel}>
          {t('buyer.cart.remove.no')}
        </button>
        <button type="button" className="cart-remove-confirm__confirm" onClick={onConfirm}>
          {t('buyer.cart.remove.yes')}
        </button>
      </div>
    </div>
  );
}

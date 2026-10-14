import { ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  onGoCatalog: () => void;
}

/** Пустая корзина (docs/18 §20): сообщение + переход в Каталог. */
export default function CartEmptyState({ onGoCatalog }: Props) {
  const { t } = useTranslation();
  return (
    <div className="cart-empty" role="status">
      <span className="cart-empty__icon" aria-hidden>
        <ShoppingCart size={42} strokeWidth={1.8} />
      </span>
      <p className="cart-empty__title">{t('buyer.cart.empty.title')}</p>
      <p className="cart-empty__text">{t('buyer.cart.empty.text')}</p>
      <button type="button" className="btn-primary cart-empty__btn" onClick={onGoCatalog}>
        {t('buyer.cart.empty.cta')}
      </button>
    </div>
  );
}

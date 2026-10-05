import { ShoppingCart } from 'lucide-react';

interface Props {
  onGoCatalog: () => void;
}

/** Пустая корзина (docs/18 §20): сообщение + переход в Каталог. */
export default function CartEmptyState({ onGoCatalog }: Props) {
  return (
    <div className="cart-empty" role="status">
      <span className="cart-empty__icon" aria-hidden>
        <ShoppingCart size={42} strokeWidth={1.8} />
      </span>
      <p className="cart-empty__title">Корзина пуста</p>
      <p className="cart-empty__text">Добавьте товары из каталога, чтобы оформить заказ.</p>
      <button type="button" className="btn-primary cart-empty__btn" onClick={onGoCatalog}>
        Перейти в каталог
      </button>
    </div>
  );
}

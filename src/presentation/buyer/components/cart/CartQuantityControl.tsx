import { Minus, Plus } from 'lucide-react';
import { canDecrement, canIncrement } from '../../../../domain/rules/cart-rules';

interface Props {
  quantity: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
}

/**
 * Количество в корзине: `−  qty  +`, без свободного ввода (docs/18 §11).
 * Границы 1..MAX_CART_QTY — из доменных правил; на границе кнопка disabled.
 * Количество — намерение покупателя, не резерв стока.
 */
export default function CartQuantityControl({ quantity, disabled = false, onChange }: Props) {
  const dec = !disabled && canDecrement(quantity);
  const inc = !disabled && canIncrement(quantity);

  return (
    <div className="cart-qty" role="group" aria-label="Количество">
      <button
        type="button"
        className="cart-qty__btn"
        aria-label="Уменьшить количество"
        disabled={!dec}
        onClick={() => onChange(quantity - 1)}
      >
        <Minus size={16} strokeWidth={2.6} aria-hidden />
      </button>
      <span className="cart-qty__value" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className="cart-qty__btn"
        aria-label="Увеличить количество"
        disabled={!inc}
        onClick={() => onChange(quantity + 1)}
      >
        <Plus size={16} strokeWidth={2.6} aria-hidden />
      </button>
    </div>
  );
}

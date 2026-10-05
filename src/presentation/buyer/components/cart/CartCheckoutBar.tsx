import { formatMoneyMinor } from '../../../../domain/rules/product-rules';

interface Props {
  total: number;
  currencySymbol: string;
  /** Нельзя оформить: пусто/нет выбора/невалидный сток/пауза/реконсиляция (docs/18 §22). */
  disabled: boolean;
  onCheckout: () => void;
}

/**
 * Нижний CTA — действие (в отличие от информационного блока итога). Содержит
 * сумму и не активируется, пока корзина не готова к оформлению (docs/18 §21–§22).
 */
export default function CartCheckoutBar({ total, currencySymbol, disabled, onCheckout }: Props) {
  return (
    <div className="cart-cta" data-testid="cart-cta">
      <button
        type="button"
        className="cart-cta__btn"
        disabled={disabled}
        onClick={onCheckout}
      >
        Оформить заказ · {formatMoneyMinor(total, currencySymbol)}
      </button>
    </div>
  );
}

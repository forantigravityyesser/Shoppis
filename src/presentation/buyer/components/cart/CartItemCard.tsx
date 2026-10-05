import { Check, Trash2 } from 'lucide-react';
import type { BuyerCartItem, CartItemView } from '../../../../application/read-models/cart';
import { formatMoneyMinor } from '../../../../domain/rules/product-rules';
import { getInitial } from '../../../../domain/rules/initial';
import SafeImage from '../../../shared/components/SafeImage';
import CartQuantityControl from './CartQuantityControl';
import CartRemoveConfirmation from './CartRemoveConfirmation';

interface Props {
  item: BuyerCartItem;
  view: CartItemView;
  /** false — ссылка ещё жива, но стока меньше запрошенного количества (docs/18 §12). */
  orderable: boolean;
  /** Открыто ли inline-подтверждение удаления именно для этой позиции. */
  confirming: boolean;
  onToggleSelected: () => void;
  onQuantityChange: (quantity: number) => void;
  /** Уменьшить количество до текущего доступного остатка (docs/18 §12). */
  onFixQuantity: () => void;
  onRequestRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  /** Переход в карточку товара — только по фото и названию (docs/18 §14). */
  onOpenProduct: () => void;
}

function variantLabel(view: CartItemView): string | null {
  if (view.variantName && view.variantValue) return `${view.variantName}: ${view.variantValue}`;
  return view.variantValue || view.variantName || null;
}

/**
 * Карточка позиции корзины: selection слева, фото, название + вариант, цена,
 * количество и удаление. Навигация в товар — только по фото/названию;
 * чекбокс, количество и удаление не навигируют (docs/18 §13–§14).
 */
export default function CartItemCard({
  item,
  view,
  orderable,
  confirming,
  onToggleSelected,
  onQuantityChange,
  onFixQuantity,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove,
  onOpenProduct,
}: Props) {
  const variant = variantLabel(view);
  const soldOut = view.availableQuantity === 0;

  return (
    <article className={`cart-item${orderable ? '' : ' cart-item--unavailable'}`}>
      <div className="cart-item__row">
        <button
          type="button"
          role="checkbox"
          aria-checked={item.selected}
          aria-label={item.selected ? 'Убрать из оформления' : 'Включить в оформление'}
          className={`cart-item__select${item.selected ? ' cart-item__select--on' : ''}`}
          onClick={onToggleSelected}
        >
          {item.selected ? <Check size={15} strokeWidth={3} aria-hidden /> : null}
        </button>

        <button
          type="button"
          className="cart-item__media"
          aria-label={`Открыть «${view.title}»`}
          onClick={onOpenProduct}
        >
          <SafeImage
            src={view.imageUrl}
            alt={view.title}
            className="cart-item__img"
            fallback={
              <span className="cart-item__placeholder" aria-hidden>
                {getInitial(view.title)}
              </span>
            }
          />
        </button>

        <div className="cart-item__info">
          <button type="button" className="cart-item__title" onClick={onOpenProduct}>
            {view.title}
          </button>
          {variant ? <span className="cart-item__variant">{variant}</span> : null}
          {!orderable ? (
            <div className="cart-item__unavailable" role="status">
              <span>
                {soldOut ? 'Нет в наличии' : `Доступно только ${view.availableQuantity} шт.`}
              </span>
              {!soldOut ? (
                <button type="button" className="cart-item__fix" onClick={onFixQuantity}>
                  Уменьшить до {view.availableQuantity}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="cart-item__bottom">
            <span className="cart-item__price">
              {formatMoneyMinor(view.unitPrice, view.currencySymbol)}
            </span>
            <CartQuantityControl
              quantity={item.quantity}
              disabled={soldOut}
              onChange={onQuantityChange}
            />
            <button
              type="button"
              className="cart-item__remove"
              aria-label={`Удалить «${view.title}» из корзины`}
              onClick={onRequestRemove}
            >
              <Trash2 size={18} strokeWidth={2.2} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {confirming ? (
        <CartRemoveConfirmation onCancel={onCancelRemove} onConfirm={onConfirmRemove} />
      ) : null}
    </article>
  );
}

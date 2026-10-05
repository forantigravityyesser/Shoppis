import { ShoppingCart } from 'lucide-react';
import type { StorefrontProductCard } from '../../../application/read-models/storefront';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import { getInitial } from '../../../domain/rules/initial';
import SafeImage from '../../shared/components/SafeImage';
import FavoriteButton from './FavoriteButton';

interface Props {
  product: StorefrontProductCard;
  currencySymbol: string;
  onOpen: (id: string) => void;
}

/**
 * Карточка товара — единый белый скруглённый блок. Открытие товара и «сердце» —
 * два независимых интерактивных элемента: `ProductOpenArea` (button) содержит фото
 * и info, `FavoriteButton` — соседний button (клик не открывает товар). Никакого
 * `role=button` на контейнере и вложенных кнопок. docs/15 §7.1.
 */
export default function ProductCard({ product, currencySymbol, onOpen }: Props) {
  const { id, title, imageUrl, price, available } = product;

  return (
    <article className={`product-card${available ? '' : ' product-card--soldout'}`}>
      <button
        type="button"
        className="product-card__open"
        aria-label={title}
        onClick={() => onOpen(id)}
      >
        <span className="product-card__media">
          <SafeImage
            src={imageUrl}
            alt={title}
            className="product-card__img"
            fallback={
              <span className="product-card__placeholder" aria-hidden>
                {getInitial(title)}
              </span>
            }
          />
        </span>

        <span className="product-card__info">
          {!available ? <span className="product-card__badge">Нет в наличии</span> : null}
          <span className="product-card__title">{title}</span>
          <span className="product-card__price">
            <ShoppingCart size={14} strokeWidth={2.5} aria-hidden />
            {formatMoneyMinor(price, currencySymbol)}
          </span>
        </span>
      </button>

      <FavoriteButton productId={id} />
    </article>
  );
}

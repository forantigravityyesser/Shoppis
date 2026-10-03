import type { KeyboardEvent } from 'react';
import type { StorefrontProductCard } from '../../../application/read-models/storefront';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import { sellerAvatarInitial } from '../../../domain/rules/seller-avatar';
import { useImageFallback } from '../hooks/useImageFallback';
import FavoriteButton from './FavoriteButton';

interface Props {
  product: StorefrontProductCard;
  currencySymbol: string;
  onOpen: (id: string) => void;
}

/**
 * Карточка товара — единый белый скруглённый блок: внутреннее скруглённое фото
 * с сердцем в углу, ниже — название (слева, перенос до 2 строк) и цена (справа,
 * жирным). Sold out — бейдж «Нет в наличии». Вся карточка открывает товар. docs/13 §9-11.
 */
export default function ProductCard({ product, currencySymbol, onOpen }: Props) {
  const { id, title, imageUrl, price, available } = product;
  const { failed, onError } = useImageFallback(imageUrl);
  const showImage = Boolean(imageUrl) && !failed;

  const open = () => onOpen(id);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  };

  return (
    <article
      className={`product-card${available ? '' : ' product-card--soldout'}`}
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      <div className="product-card__media">
        {showImage ? (
          <img
            className="product-card__img"
            src={imageUrl as string}
            alt={title}
            loading="lazy"
            decoding="async"
            onError={onError}
          />
        ) : (
          <span className="product-card__placeholder" aria-hidden>
            {sellerAvatarInitial(title)}
          </span>
        )}
      </div>

      <FavoriteButton productId={id} />
      {!available ? <span className="product-card__badge">Нет в наличии</span> : null}

      <div className="product-card__info">
        <h3 className="product-card__title">{title}</h3>
        <span className="product-card__price">{formatMoneyMinor(price, currencySymbol)}</span>
      </div>
    </article>
  );
}

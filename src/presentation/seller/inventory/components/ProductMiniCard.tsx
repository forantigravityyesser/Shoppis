import { ChevronRight, HelpCircle, MessageCircle, Star } from 'lucide-react';
import type { InventoryProductItem } from '../../../../application/hooks/useInventory';
import { currencySymbol } from '../../../../domain/constants/currencies';
import { formatMoneyMinor } from '../../../../domain/rules/product-rules';

interface ProductMiniCardProps {
  product: InventoryProductItem;
  onClick: () => void;
}

/** Компактная строка товара в CategoryView: фото, название, остаток, цена, сигналы. */
export default function ProductMiniCard({ product, onClick }: ProductMiniCardProps) {
  const hidden = product.stockState === 'hidden';
  return (
    <button
      type="button"
      className={`mini-card${hidden ? ' mini-card--hidden' : ''}`}
      onClick={onClick}
    >
      <span className="mini-card__thumb" aria-hidden>
        {product.imageUrl ? (
          <img className="mini-card__img" src={product.imageUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="mini-card__emoji">{product.emoji || '📦'}</span>
        )}
      </span>

      <span className="mini-card__body">
        <span className="mini-card__title">{product.title}</span>
        <span className={`mini-card__stock mini-card__stock--${product.stockState}`}>
          {stockLabel(product)}
        </span>
        <span className="mini-card__price">
          {formatMoneyMinor(product.priceMinor, currencySymbol(product.currency))}
        </span>
        <span className="mini-card__signals">
          {product.rating > 0 ? (
            <span className="mini-card__signal">
              <Star size={13} /> {product.rating.toFixed(1)}
            </span>
          ) : null}
          {product.reviewsCount > 0 ? (
            <span className="mini-card__signal">
              <MessageCircle size={13} /> {product.reviewsCount}
            </span>
          ) : null}
          {product.questionsCount > 0 ? (
            <span className="mini-card__signal">
              <HelpCircle size={13} /> {product.questionsCount}
            </span>
          ) : null}
        </span>
      </span>

      <ChevronRight size={18} className="mini-card__chevron" />
    </button>
  );
}

function stockLabel(product: InventoryProductItem): string {
  switch (product.stockState) {
    case 'out_of_stock':
      return 'Нет в наличии';
    case 'low_stock':
      return `⚠ ${product.stockAvailable} шт.`;
    case 'hidden':
      return 'Скрыт';
    default:
      return `${product.stockAvailable} шт.`;
  }
}

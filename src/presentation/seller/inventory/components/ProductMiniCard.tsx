import { ChevronRight, HelpCircle, MessageCircle, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { InventoryProductItem } from '../../../../application/hooks/useInventory';
import { currencySymbol } from '../../../../domain/constants/currencies';
import { formatMoneyMinor } from '../../../../domain/rules/product-rules';

interface ProductMiniCardProps {
  product: InventoryProductItem;
  onClick: () => void;
  /** Непросмотренные отзывы / вопросы без ответа — индикатор внимания (Phase D). */
  attention?: { reviews: number; questions: number } | null;
}

/** Компактная строка товара в CategoryView: фото, название, остаток, цена, сигналы. */
export default function ProductMiniCard({ product, onClick, attention = null }: ProductMiniCardProps) {
  const { t } = useTranslation();
  const hidden = product.stockState === 'hidden';
  const attentionCount = attention ? attention.reviews + attention.questions : 0;

  const stockLabel = (): string => {
    switch (product.stockState) {
      case 'out_of_stock':
        return t('seller.inventory.stock.outOfStock');
      case 'low_stock':
        return t('seller.inventory.stock.low', { count: product.stockAvailable });
      case 'hidden':
        return t('seller.inventory.stock.hidden');
      default:
        return t('seller.inventory.stock.available', { count: product.stockAvailable });
    }
  };
  return (
    <button
      type="button"
      className={`mini-card${hidden ? ' mini-card--hidden' : ''}`}
      onClick={onClick}
    >
      <span className="mini-card__thumb" aria-hidden>
        {product.imageUrl ? (
          <img
            className="mini-card__img"
            src={product.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="mini-card__emoji">{product.emoji || '📦'}</span>
        )}
      </span>

      <span className="mini-card__body">
        <span className="mini-card__title">{product.title}</span>
        <span className={`mini-card__stock mini-card__stock--${product.stockState}`}>
          {stockLabel()}
        </span>
        <span className="mini-card__price">
          {formatMoneyMinor(product.priceMinor, currencySymbol(product.currency))}
        </span>
        <span className="mini-card__signals">
          {attentionCount > 0 ? (
            <span
              className="mini-card__attention"
              aria-label={t('seller.inventory.attentionAria', {
                reviews: attention?.reviews ?? 0,
                questions: attention?.questions ?? 0,
              })}
            >
              {attentionCount > 99 ? '99+' : attentionCount}
            </span>
          ) : null}
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

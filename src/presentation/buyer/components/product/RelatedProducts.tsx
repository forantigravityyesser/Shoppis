import { useNavigate } from 'react-router';
import type { StorefrontRelatedProduct } from '../../../../application/read-models/storefront-product';
import { getInitial } from '../../../../domain/rules/initial';
import { formatMoneyMinor } from '../../../../domain/rules/product-rules';
import { useHaptic } from '../../../../application/hooks/useHaptic';
import SafeImage from '../../../shared/components/SafeImage';

interface Props {
  products: StorefrontRelatedProduct[];
  currencySymbol: string;
}

/**
 * «Похожее» — сетка в 2 колонки (вертикальный скролл вместе с панелью). Мини-карточки
 * связанных товаров: фото, название, цена (+ зачёркнутая при скидке), «нет в наличии».
 * Тап → карточка товара. Битые/пустые фото → плейсхолдер-буква (`SafeImage`). docs/14 §7.
 */
export default function RelatedProducts({ products, currencySymbol }: Props) {
  const navigate = useNavigate();
  const { selectTick } = useHaptic();

  const open = (id: string) => {
    selectTick();
    navigate(`/product/${id}`);
  };

  return (
    <div className="pd-related-grid" data-testid="related-products">
      {products.map((product) => (
        <button
          key={product.id}
          type="button"
          className="pd-related-card"
          onClick={() => open(product.id)}
        >
          <span className="pd-related-card__media">
            <SafeImage
              src={product.imageUrl}
              alt=""
              fallback={
                <span className="pd-related-card__placeholder" aria-hidden>
                  {getInitial(product.title)}
                </span>
              }
            />
            {!product.available ? (
              <span className="pd-related-card__badge">Нет в наличии</span>
            ) : null}
          </span>

          <span className="pd-related-card__title">{product.title}</span>

          <span className="pd-related-card__price">
            <span className="pd-related-card__current">
              {formatMoneyMinor(product.price, currencySymbol)}
            </span>
            {product.originalPrice != null ? (
              <s className="pd-related-card__old">
                {formatMoneyMinor(product.originalPrice, currencySymbol)}
              </s>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}

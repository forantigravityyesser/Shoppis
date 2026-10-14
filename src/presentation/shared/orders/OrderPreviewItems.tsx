import { useTranslation } from 'react-i18next';
import type { OrderPreviewItem } from '../../../application/read-models/order';
import { getInitial } from '../../../domain/rules/initial';
import SafeImage from '../components/SafeImage';

interface Props {
  previewItems: OrderPreviewItem[];
  itemCount: number;
}

/**
 * Превью позиций заказа: до 3 миниатюр + `+N`, если позиций больше (docs/22 §5.3).
 * Нет снимка → placeholder с инициалом (SafeImage; без broken UI).
 */
export default function OrderPreviewItems({ previewItems, itemCount }: Props) {
  const { t } = useTranslation();
  if (previewItems.length === 0) return null;
  const extra = Math.max(0, itemCount - previewItems.length);

  return (
    <div className="order-preview" data-testid="order-preview">
      {previewItems.map((item, index) => (
        <span className="order-preview__cell" key={`${item.title}-${index}`}>
          <SafeImage
            src={item.imageUrl}
            alt={item.title}
            className="order-preview__img"
            fallback={
              <span className="order-preview__placeholder" aria-hidden>
                {getInitial(item.title)}
              </span>
            }
          />
          {item.quantity > 1 ? (
            <span
              className="order-preview__qty"
              aria-label={t('orders.itemQtyAria', { count: item.quantity })}
            >
              {item.quantity}
            </span>
          ) : null}
        </span>
      ))}
      {extra > 0 ? (
        <span className="order-preview__more" data-testid="order-preview-more">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

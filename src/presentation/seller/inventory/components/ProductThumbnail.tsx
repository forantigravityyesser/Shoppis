import { useTranslation } from 'react-i18next';
import type { InventoryProductItem } from '../../../../application/hooks/useInventory';

interface ProductThumbnailProps {
  product: InventoryProductItem;
  onClick: () => void;
}

/** Квадратная миниатюра товара внутри InventoryCategoryRow. Не знает про источник данных. */
export default function ProductThumbnail({ product, onClick }: ProductThumbnailProps) {
  const { t } = useTranslation();
  const hidden = product.status === 'ARCHIVED';
  const label = hidden
    ? t('seller.inventory.thumbnailArchived', { title: product.title })
    : product.title;

  return (
    <button
      type="button"
      className={`inv-thumb${hidden ? ' inv-thumb--hidden' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
    >
      {product.imageUrl ? (
        <img
          className="inv-thumb__img"
          src={product.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="inv-thumb__fallback" aria-hidden>
          {product.emoji || '📦'}
        </span>
      )}
    </button>
  );
}

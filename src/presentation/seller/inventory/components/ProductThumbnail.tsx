import type { InventoryProductItem } from '../../../../application/hooks/useInventory';

interface ProductThumbnailProps {
  product: InventoryProductItem;
  onClick: () => void;
}

/** Квадратная миниатюра товара внутри CategoryCard. Не знает про источник данных. */
export default function ProductThumbnail({ product, onClick }: ProductThumbnailProps) {
  const hidden = product.status === 'ARCHIVED';
  const label = hidden ? `${product.title} (в архиве)` : product.title;

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

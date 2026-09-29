import { MoreHorizontal, Shapes } from 'lucide-react';
import type {
  InventoryCategoryItem,
  InventoryProductItem,
} from '../../../../application/hooks/useInventory';
import { PREVIEW_VISIBLE } from '../layout';
import ProductPreviewRow from './ProductPreviewRow';

interface CategoryCardProps {
  category: InventoryCategoryItem;
  previewProducts: InventoryProductItem[];
  variant: 'wide' | 'compact';
  onOpen: () => void;
  onOpenProduct: (productId: string) => void;
  onAddProduct: () => void;
  onMore?: () => void;
}

/** Крупный контейнер каталога: заголовок + строка превью товаров + «+». Спека §18–29. */
export default function CategoryCard({
  category,
  previewProducts,
  variant,
  onOpen,
  onOpenProduct,
  onAddProduct,
  onMore,
}: CategoryCardProps) {
  const visible = variant === 'wide' ? PREVIEW_VISIBLE.wide : PREVIEW_VISIBLE.compact;

  return (
    <article className={`inv-cat inv-cat--${variant}`} onClick={onOpen}>
      <div className="inv-cat__head">
        <span className="inv-cat__avatar" aria-hidden>
          {category.imageUrl ? (
            <img className="inv-cat__avatar-img" src={category.imageUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <Shapes size={16} strokeWidth={2} />
          )}
        </span>
        <span className="inv-cat__name">{category.name}</span>
        <span className="inv-cat__count">
          {category.productCount}
          {category.archivedCount > 0 ? (
            <span className="inv-cat__archived" title={`${category.archivedCount} в архиве`}>
              +{category.archivedCount}
              <span className="inv-cat__archived-word"> в архиве</span>
            </span>
          ) : null}
        </span>
        {onMore ? (
          <button
            type="button"
            className="inv-cat__more"
            onClick={(e) => {
              e.stopPropagation();
              onMore();
            }}
            aria-label={`Действия категории «${category.name}»`}
          >
            <MoreHorizontal size={18} />
          </button>
        ) : null}
      </div>

      {previewProducts.length === 0 ? (
        <div className="inv-cat__empty">
          <span className="inv-cat__empty-text">Пока нет товаров</span>
          <button
            type="button"
            className="inv-cat__empty-add"
            onClick={(e) => {
              e.stopPropagation();
              onAddProduct();
            }}
          >
            + Добавить товар
          </button>
        </div>
      ) : (
        <ProductPreviewRow
          products={previewProducts}
          visible={visible}
          onOpenProduct={onOpenProduct}
          onAddProduct={onAddProduct}
        />
      )}
    </article>
  );
}

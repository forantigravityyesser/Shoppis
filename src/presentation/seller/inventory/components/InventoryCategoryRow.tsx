import { Shapes } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UNCATEGORIZED_ID } from '../../../../domain/constants/categories';
import type {
  InventoryCategoryItem,
  InventoryProductItem,
} from '../../../../application/hooks/useInventory';
import { PREVIEW_VISIBLE } from '../layout';
import ProductPreviewRow from './ProductPreviewRow';

interface InventoryCategoryRowProps {
  category: InventoryCategoryItem;
  previewProducts: InventoryProductItem[];
  onOpen: () => void;
  onOpenProduct: (productId: string) => void;
  onAddProduct: () => void;
  /** 1-based позиция категории в каталоге покупателя; undefined — бейдж не показывается. */
  position?: number;
  /** Открыть выбор позиции в каталоге. */
  onReorder?: () => void;
}

/** Строка категории: заголовок + строка превью товаров + «+». Спека §18–29. */
export default function InventoryCategoryRow({
  category,
  previewProducts,
  onOpen,
  onOpenProduct,
  onAddProduct,
  position,
  onReorder,
}: InventoryCategoryRowProps) {
  const { t } = useTranslation();
  return (
    <article className="inv-cat" onClick={onOpen}>
      <div className="inv-cat__head">
        <span className="inv-cat__avatar" aria-hidden>
          {category.imageUrl ? (
            <img
              className="inv-cat__avatar-img"
              src={category.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <Shapes size={16} strokeWidth={2} />
          )}
        </span>
        <span className="inv-cat__name">
          {category.id === UNCATEGORIZED_ID
            ? t('seller.inventory.categoryPicker.uncategorized')
            : category.name}
        </span>
        {position && onReorder ? (
          <button
            type="button"
            className={`inv-cat__rank${position <= 4 ? ` inv-cat__rank--${position}` : ' inv-cat__rank--n'}`}
            onClick={(e) => {
              e.stopPropagation();
              onReorder();
            }}
            aria-label={t('seller.inventory.positionAria', { position })}
          >
            {position}
          </button>
        ) : null}
        <span className="inv-cat__count">
          {category.productCount}
          {category.archivedCount > 0 ? (
            <span
              className="inv-cat__archived"
              title={t('seller.inventory.archivedCount', { count: category.archivedCount })}
            >
              +{category.archivedCount}
              <span className="inv-cat__archived-word">
                {' '}
                {t('seller.inventory.archived')}
              </span>
            </span>
          ) : null}
        </span>
      </div>

      {previewProducts.length === 0 ? (
        <div className="inv-cat__empty">
          <span className="inv-cat__empty-text">{t('seller.inventory.noProducts')}</span>
          <button
            type="button"
            className="inv-cat__empty-add"
            onClick={(e) => {
              e.stopPropagation();
              onAddProduct();
            }}
          >
            + {t('seller.inventory.addProduct')}
          </button>
        </div>
      ) : (
        <ProductPreviewRow
          products={previewProducts}
          visible={PREVIEW_VISIBLE}
          onOpenProduct={onOpenProduct}
          onAddProduct={onAddProduct}
        />
      )}
    </article>
  );
}

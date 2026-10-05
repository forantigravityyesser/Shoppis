import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { InventoryProductItem } from '../../../../application/hooks/useInventory';
import ProductThumbnail from './ProductThumbnail';
import AddProductTile from './AddProductTile';

/** Должно совпадать с `.inv-preview__track { --inv-gap }` в inventory.css. */
const PREVIEW_GAP = 6;

interface ProductPreviewRowProps {
  products: InventoryProductItem[];
  /** Сколько карточек видно одновременно (ширина карточки = 1/visible). */
  visible: number;
  onOpenProduct: (productId: string) => void;
  onAddProduct: () => void;
}

/**
 * Строка превью товаров категории. Без нативного скролла и свайпа: листается
 * стрелками ровно на одну карточку (индекс), поэтому карточки не «выпадают»
 * и поведение предсказуемо на телефоне.
 */
export default function ProductPreviewRow({
  products,
  visible,
  onOpenProduct,
  onAddProduct,
}: ProductPreviewRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [stepPx, setStepPx] = useState(0);

  const total = products.length + 1; // + AddProductTile
  const maxIndex = Math.max(0, total - visible);
  const current = Math.min(index, maxIndex);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      const cardWidth = (el.clientWidth - (visible - 1) * PREVIEW_GAP) / visible;
      setStepPx(Math.max(0, cardWidth + PREVIEW_GAP));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  const step = (direction: -1 | 1) =>
    setIndex(Math.min(Math.max(current + direction, 0), maxIndex));

  return (
    <div className="inv-preview">
      <div
        ref={trackRef}
        className="inv-preview__track"
        style={
          {
            '--inv-visible': String(visible),
            transform: `translateX(${-current * stepPx}px)`,
          } as CSSProperties
        }
      >
        {products.map((product) => (
          <ProductThumbnail
            key={product.id}
            product={product}
            onClick={() => onOpenProduct(product.id)}
          />
        ))}
        <AddProductTile onClick={onAddProduct} />
      </div>

      {current > 0 ? (
        <button
          type="button"
          className="inv-preview__arrow inv-preview__arrow--left"
          onClick={(e) => {
            e.stopPropagation();
            step(-1);
          }}
          aria-label="Предыдущие товары"
        >
          <ChevronLeft size={20} />
        </button>
      ) : null}

      {current < maxIndex ? (
        <button
          type="button"
          className="inv-preview__arrow inv-preview__arrow--right"
          onClick={(e) => {
            e.stopPropagation();
            step(1);
          }}
          aria-label="Следующие товары"
        >
          <ChevronRight size={20} />
        </button>
      ) : null}
    </div>
  );
}

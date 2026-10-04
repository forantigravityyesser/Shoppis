import { useState } from 'react';
import { motion } from 'framer-motion';
import type { StorefrontProductImage } from '../../../../application/read-models/storefront-product';
import { getInitial } from '../../../../domain/rules/initial';
import { useHaptic } from '../../../../application/hooks/useHaptic';
import { useImageFallback } from '../../hooks/useImageFallback';
import ProductImageViewer from './ProductImageViewer';

interface Props {
  images: StorefrontProductImage[];
  title: string;
}

/**
 * Галерея товара (docs/14 §4): главное фото заполняет блок по ширине (cover,
 * боковые отступы 20px) и миниатюры внутри блока фото — снизу по центру. Активное фото исключается из
 * ряда и возвращается в него при выборе другого. Клик по главному фото открывает
 * fullscreen-просмотр. 0 фото → плейсхолдер, 1 → без миниатюр. Рассчитан на
 * `key={product.id}` у родителя (сброс при переходе на другой товар).
 */
export default function ProductGallery({ images, title }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const { selectTick } = useHaptic();

  const main = images[activeIndex] ?? images[0] ?? null;
  const { failed, onError } = useImageFallback(main?.url ?? null);
  const showMain = Boolean(main?.url) && !failed;

  const selectImage = (index: number) => {
    if (index === activeIndex) return;
    selectTick();
    setActiveIndex(index);
  };

  return (
    <div className="pd-gallery" data-testid="product-gallery">
      <div className="pd-gallery__main">
        {showMain ? (
          <button
            type="button"
            className="pd-gallery__open"
            aria-label="Открыть фото"
            onClick={() => setViewerOpen(true)}
          >
            <motion.img
              key={main?.url}
              src={main?.url as string}
              alt={title}
              decoding="async"
              onError={onError}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            />
          </button>
        ) : (
          <span className="pd-gallery__placeholder" aria-hidden>
            {getInitial(title)}
          </span>
        )}
      </div>

      {images.length > 1 ? (
        <div className="pd-thumbs" data-testid="product-thumbs">
          {images.map((image, index) =>
            index === activeIndex ? null : (
              <button
                key={`${image.url}-${index}`}
                type="button"
                className="pd-thumbs__item"
                aria-label={`Фото ${index + 1}`}
                onClick={() => selectImage(index)}
              >
                <img src={image.thumbUrl ?? image.url} alt="" loading="lazy" decoding="async" />
              </button>
            ),
          )}
        </div>
      ) : null}

      {viewerOpen ? (
        <ProductImageViewer
          images={images}
          activeIndex={activeIndex}
          title={title}
          onClose={() => setViewerOpen(false)}
          onSelect={selectImage}
        />
      ) : null}
    </div>
  );
}

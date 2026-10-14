import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { StorefrontProductImage } from '../../../../application/read-models/storefront-product';
import { getInitial } from '../../../../domain/rules/initial';
import { useHaptic } from '../../../../application/hooks/useHaptic';
import { useImageFallback } from '../../../shared/hooks/useImageFallback';
import ProductImageViewer from './ProductImageViewer';

interface Props {
  images: StorefrontProductImage[];
  title: string;
}

/**
 * Галерея товара (docs/14 §4): главное фото показывается целиком (contain,
 * без обрезки; боковые отступы 20px) и миниатюры внутри блока фото — снизу по центру. Активное фото исключается из
 * ряда и возвращается в него при выборе другого. Клик по главному фото открывает
 * fullscreen-просмотр. 0 фото → плейсхолдер, 1 → без миниатюр. Рассчитан на
 * `key={product.id}` у родителя (сброс при переходе на другой товар).
 */
export default function ProductGallery({ images, title }: Props) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const { selectTick } = useHaptic();

  const main = images[activeIndex] ?? images[0] ?? null;
  const { failed, onError } = useImageFallback(main?.url ?? null);
  const showMain = Boolean(main?.url) && !failed;
  // Мгновенный фолбэк: миниатюра (thumb) грузится заметно быстрее full
  // (512 против 1000px), поэтому держим её фоном под фото и плавно проявляем
  // full по onLoad. Смена фото сбрасывает флаг сравнением по URL (без эффекта).
  const placeholder = main?.thumbUrl ?? null;
  const mainLoaded = main?.url != null && loadedSrc === main.url;

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
            aria-label={t('buyer.product.openPhotoAria')}
            onClick={() => setViewerOpen(true)}
            style={
              placeholder
                ? { backgroundImage: `url("${placeholder}")` }
                : undefined
            }
          >
            <motion.img
              key={main?.url}
              src={main?.url as string}
              alt={title}
              decoding="async"
              onError={onError}
              onLoad={() => setLoadedSrc(main?.url ?? null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: mainLoaded ? 1 : 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
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
                aria-label={t('buyer.product.photoAria', { number: index + 1 })}
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

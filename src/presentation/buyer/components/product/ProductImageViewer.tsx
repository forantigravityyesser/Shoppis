import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { StorefrontProductImage } from '../../../../application/read-models/storefront-product';
import { useImageViewerGestures } from './useImageViewerGestures';

interface Props {
  images: StorefrontProductImage[];
  activeIndex: number;
  title: string;
  onClose: () => void;
  onSelect: (index: number) => void;
}

/**
 * Fullscreen-просмотр фото товара (клик по главному фото). Оверлей через портал:
 * тёмный фон с плавным появлением, фото целиком (`contain`), закрытие — крестик/
 * фон/Escape, переключение между фото — миниатюры внизу. Свободный зум: пинч,
 * двойной тап и панорамирование — вынесены в `useImageViewerGestures`
 * (docs/18 PD-H-08). docs/14 §4.
 */
export default function ProductImageViewer({
  images,
  activeIndex,
  title,
  onClose,
  onSelect,
}: Props) {
  const current = images[activeIndex] ?? images[0] ?? null;
  const mediaRef = useRef<HTMLDivElement>(null);
  // Смена фото (индекс/URL) сбрасывает зум/позицию внутри хука.
  const { scale, position, onPointerDown, onPointerMove, onPointerUp, resetGesture } =
    useImageViewerGestures(mediaRef, `${activeIndex}:${current?.url ?? ''}`);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!current) return null;

  return createPortal(
    <motion.div
      className="pd-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClose}
    >
      <button type="button" className="pd-viewer__close" aria-label="Закрыть" onClick={onClose}>
        <X size={22} />
      </button>

      <div
        className="pd-viewer__media"
        ref={mediaRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          className="pd-viewer__img"
          src={current.url}
          alt={title}
          draggable={false}
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
          }}
          onClick={(event) => event.stopPropagation()}
        />
      </div>

      {images.length > 1 ? (
        <div className="pd-viewer__thumbs" onClick={(event) => event.stopPropagation()}>
          {images.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              type="button"
              className={`pd-viewer__thumb${
                index === activeIndex ? ' pd-viewer__thumb--active' : ''
              }`}
              aria-label={`Фото ${index + 1}`}
              onClick={() => {
                resetGesture();
                onSelect(index);
              }}
            >
              <img src={image.thumbUrl ?? image.url} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      ) : null}
    </motion.div>,
    document.body,
  );
}

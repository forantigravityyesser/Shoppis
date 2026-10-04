import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { StorefrontProductImage } from '../../../../application/read-models/storefront-product';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const TAP_MOVE_THRESHOLD = 8;
const DOUBLE_TAP_MS = 300;

interface Props {
  images: StorefrontProductImage[];
  activeIndex: number;
  title: string;
  onClose: () => void;
  onSelect: (index: number) => void;
}

interface Point {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Fullscreen-просмотр фото товара (клик по главному фото). Оверлей через портал:
 * тёмный фон с плавным появлением, фото целиком (`contain`), закрытие — крестик/
 * фон/Escape, переключение между фото — миниатюры внизу. Свободный зум: пинч
 * (2 пальца), двойной тап (туда-обратно) и панорамирование при увеличении.
 * docs/14 §4.
 */
export default function ProductImageViewer({
  images,
  activeIndex,
  title,
  onClose,
  onSelect,
}: Props) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{
    startDist: number;
    startScale: number;
    startMid: Point;
    startPos: Point;
  } | null>(null);
  const pan = useRef<{ pointerId: number; start: Point; startPos: Point; moved: boolean } | null>(
    null,
  );
  const multiTouch = useRef(false);
  const lastTap = useRef(0);

  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState<Point>({ x: 0, y: 0 });
  const [renderedIndex, setRenderedIndex] = useState(activeIndex);

  // Смена фото — сбрасываем зум/позицию прямо в рендере (adjust state on prop
  // change), без эффекта: не бывает кадра со старым зумом.
  if (renderedIndex !== activeIndex) {
    setRenderedIndex(activeIndex);
    setScale(1);
    setPos({ x: 0, y: 0 });
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Сброс жест-буферов (вызывается из обработчика выбора фото, не в рендере).
  const resetGesture = () => {
    pointers.current.clear();
    pinch.current = null;
    pan.current = null;
    multiTouch.current = false;
  };

  const current = images[activeIndex] ?? images[0] ?? null;
  if (!current) return null;

  const clampPos = (x: number, y: number, s: number): Point => {
    const el = mediaRef.current;
    if (!el) return { x, y };
    const maxX = (el.clientWidth * (s - 1)) / 2;
    const maxY = (el.clientHeight * (s - 1)) / 2;
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      mediaRef.current?.setPointerCapture(event.pointerId);
    } catch {
      /* не критично (не поддерживается) */
    }

    if (pointers.current.size === 2) {
      multiTouch.current = true;
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        startScale: scale,
        startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        startPos: pos,
      };
      pan.current = null;
    } else if (pointers.current.size === 1 && scale > 1) {
      pan.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        startPos: pos,
        moved: false,
      };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const nextScale = clamp(
        (pinch.current.startScale * dist) / pinch.current.startDist,
        MIN_SCALE,
        MAX_SCALE,
      );
      setScale(nextScale);
      setPos(
        clampPos(
          pinch.current.startPos.x + (mid.x - pinch.current.startMid.x),
          pinch.current.startPos.y + (mid.y - pinch.current.startMid.y),
          nextScale,
        ),
      );
      return;
    }

    const panInfo = pan.current;
    if (panInfo && panInfo.pointerId === event.pointerId && scale > 1) {
      const dx = event.clientX - panInfo.start.x;
      const dy = event.clientY - panInfo.start.y;
      if (Math.abs(dx) > TAP_MOVE_THRESHOLD || Math.abs(dy) > TAP_MOVE_THRESHOLD) {
        panInfo.moved = true;
      }
      setPos(clampPos(panInfo.startPos.x + dx, panInfo.startPos.y + dy, scale));
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(event.pointerId);

    if (pointers.current.size < 2) pinch.current = null;

    const panInfo = pan.current;
    const isPanPointer = panInfo?.pointerId === event.pointerId;
    const moved = isPanPointer ? (panInfo?.moved ?? false) : false;
    if (isPanPointer) pan.current = null;

    // Двойной тап (одиночный тап без движения, без пинча) — зум/сброс.
    if (wasSingle && !moved && !multiTouch.current) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        if (scale > 1) {
          setScale(1);
          setPos({ x: 0, y: 0 });
        } else {
          setScale(DOUBLE_TAP_SCALE);
          setPos({ x: 0, y: 0 });
        }
      } else {
        lastTap.current = now;
      }
    }

    if (pointers.current.size === 0) multiTouch.current = false;
  };

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
          style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scale})` }}
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

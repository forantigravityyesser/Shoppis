import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import {
  DOUBLE_TAP_MS,
  TAP_MOVE_THRESHOLD,
  clampPosition,
  doubleTapTarget,
  pinchScale,
  zoomToPoint,
  type Point,
} from './image-viewer-gestures';

interface PinchState {
  startDist: number;
  startScale: number;
  startMid: Point;
  startPos: Point;
}

interface PanState {
  pointerId: number;
  start: Point;
  startPos: Point;
  moved: boolean;
}

export interface ImageViewerGestures {
  scale: number;
  position: Point;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Сброс буферов жестов и окна двойного тапа (вызывать при смене фото из миниатюр). */
  resetGesture: () => void;
}

/**
 * Gesture state machine fullscreen-просмотра: пинч (2 пальца, зум к точке между
 * пальцами — zoom-to-point), двойной тап (туда-обратно), панорамирование при
 * увеличении с ограничением по границам.
 * `mediaRef` (DOM-контейнер фото) создаётся вызывающим компонентом и нужен для
 * clamp по границам; сам хук ref не возвращает. При смене `resetKey` (фото)
 * масштаб/позиция сбрасываются прямо в рендере — без эффекта, чтобы не было
 * кадра со старым зумом. docs/18 PD-H-08.
 */
export function useImageViewerGestures(
  mediaRef: RefObject<HTMLDivElement>,
  resetKey: unknown,
): ImageViewerGestures {
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<PinchState | null>(null);
  const pan = useRef<PanState | null>(null);
  const multiTouch = useRef(false);
  const lastTap = useRef(0);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [renderedKey, setRenderedKey] = useState(resetKey);

  if (renderedKey !== resetKey) {
    setRenderedKey(resetKey);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  const resetGesture = () => {
    pointers.current.clear();
    pinch.current = null;
    pan.current = null;
    multiTouch.current = false;
    // Сброс окна двойного тапа: иначе быстрый «tap A → смена фото → tap B» может
    // дать ложный зум на новом фото (PD-R-02).
    lastTap.current = 0;
  };

  const clampPos = (x: number, y: number, s: number): Point => {
    const el = mediaRef.current;
    if (!el) return { x, y };
    return clampPosition(x, y, el.clientWidth, el.clientHeight, s);
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
        startPos: position,
      };
      pan.current = null;
    } else if (pointers.current.size === 1 && scale > 1) {
      pan.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        startPos: position,
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
      const nextScale = pinchScale(pinch.current.startScale, pinch.current.startDist, dist);
      setScale(nextScale);

      const el = mediaRef.current;
      if (el) {
        // Zoom-to-point: точка под стартовым центром пальцев остаётся на месте.
        const rect = el.getBoundingClientRect();
        const next = zoomToPoint({
          startScale: pinch.current.startScale,
          startPos: pinch.current.startPos,
          startMid: pinch.current.startMid,
          mid,
          center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          scale: nextScale,
        });
        setPosition(clampPos(next.x, next.y, nextScale));
      } else {
        // Без DOM (напр. юнит-тесты хука) — прежнее поведение: сдвиг по центру пальцев.
        setPosition(
          clampPos(
            pinch.current.startPos.x + (mid.x - pinch.current.startMid.x),
            pinch.current.startPos.y + (mid.y - pinch.current.startMid.y),
            nextScale,
          ),
        );
      }
      return;
    }

    const panInfo = pan.current;
    if (panInfo && panInfo.pointerId === event.pointerId && scale > 1) {
      const dx = event.clientX - panInfo.start.x;
      const dy = event.clientY - panInfo.start.y;
      if (Math.abs(dx) > TAP_MOVE_THRESHOLD || Math.abs(dy) > TAP_MOVE_THRESHOLD) {
        panInfo.moved = true;
      }
      setPosition(clampPos(panInfo.startPos.x + dx, panInfo.startPos.y + dy, scale));
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
        const target = doubleTapTarget(scale);
        setScale(target);
        setPosition({ x: 0, y: 0 });
      } else {
        lastTap.current = now;
      }
    }

    if (pointers.current.size === 0) multiTouch.current = false;
  };

  return {
    scale,
    position,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    resetGesture,
  };
}

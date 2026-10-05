/**
 * Чистая математика fullscreen-просмотра фото (docs/14 §4). Вынесена из
 * `ProductImageViewer`, чтобы тестировать без симуляции настоящего multi-touch
 * в jsdom. docs/18 PD-H-08.
 */

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const DOUBLE_TAP_SCALE = 2.5;
export const TAP_MOVE_THRESHOLD = 8;
export const DOUBLE_TAP_MS = 300;

export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Масштаб в допустимых границах [MIN_SCALE, MAX_SCALE]. */
export function clampScale(scale: number): number {
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

/** Смещение панорамирования, ограниченное размером блока и масштабом. */
export function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
): Point {
  const maxX = (width * (scale - 1)) / 2;
  const maxY = (height * (scale - 1)) / 2;
  return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
}

/** Целевой масштаб двойного тапа: увеличить (2.5×) или сбросить (1×). */
export function doubleTapTarget(scale: number): number {
  return scale > 1 ? MIN_SCALE : DOUBLE_TAP_SCALE;
}

/** Масштаб при пинче относительно стартового расстояния между пальцами. */
export function pinchScale(startScale: number, startDist: number, dist: number): number {
  return clampScale((startScale * dist) / (startDist || 1));
}

export interface ZoomToPointInput {
  /** Масштаб на старте пинча. */
  startScale: number;
  /** Позиция (translate) на старте пинча. */
  startPos: Point;
  /** Центр между пальцами на старте пинча (client-координаты). */
  startMid: Point;
  /** Текущий центр между пальцами. */
  mid: Point;
  /** Центр контейнера изображения (= transform-origin) в client-координатах. */
  center: Point;
  /** Текущий масштаб. */
  scale: number;
}

/**
 * Позиция изображения при зуме так, чтобы точка под стартовым центром пальцев
 * оставалась под текущим центром (zoom-to-point, а не зум относительно центра
 * картинки). При `scale === startScale` формула сводится к панорамированию
 * (сдвиг на delta центра пальцев).
 */
export function zoomToPoint(input: ZoomToPointInput): Point {
  const k = input.scale / (input.startScale || 1);
  return {
    x: k * (input.startPos.x - (input.startMid.x - input.center.x)) + (input.mid.x - input.center.x),
    y: k * (input.startPos.y - (input.startMid.y - input.center.y)) + (input.mid.y - input.center.y),
  };
}

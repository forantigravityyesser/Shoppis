/**
 * Утилиты подготовки изображений на клиенте (canvas → WebP).
 * В БД base64 НЕ пишем — возвращаем File для uploadFile().
 *
 * Декодирование через `createImageBitmap` (быстро, мало памяти) с fallback на
 * FileReader/Image для старых WebView. Небольшие размеры и качество снижают
 * вес загружаемых файлов и ускоряют и загрузку, и последующую отдачу.
 */

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    img.onerror = (err) => reject(err);
    img.onload = () => resolve(img);
    reader.readAsDataURL(file);
  });
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // некоторые форматы/браузеры — откатываемся на FileReader/Image
    }
  }
  const img = await readImage(file);
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => {},
  };
}

/** canvas → File. WebP с fallback на JPEG, если браузер не умеет кодировать WebP. */
async function canvasToFile(
  canvas: HTMLCanvasElement,
  sourceName: string,
  quality: number,
): Promise<File> {
  const baseName = sourceName.replace(/\.[^/.]+$/, '');
  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  let blob = await encode('image/webp');
  if (!blob || blob.type !== 'image/webp') {
    const jpeg = await encode('image/jpeg');
    if (jpeg) blob = jpeg;
  }
  if (!blob) throw new Error('Image encoding failed');

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${baseName}.${ext}`, {
    type: blob.type || `image/${ext}`,
    lastModified: Date.now(),
  });
}

function renderToFile(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outWidth: number,
  outHeight: number,
  sourceName: string,
  quality: number,
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outWidth, outHeight);
  return canvasToFile(canvas, sourceName, quality);
}

/** Пропорциональное сжатие до maxDimension по длинной стороне (WebP/JPEG). */
export async function compressImage(
  file: File,
  maxDimension = 1024,
  quality = 0.78,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const decoded = await decodeImage(file);
  try {
    let { width, height } = decoded;
    if (width > height) {
      if (width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      }
    } else if (height > maxDimension) {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
    return await renderToFile(
      decoded.source,
      0,
      0,
      decoded.width,
      decoded.height,
      width,
      height,
      file.name,
      quality,
    );
  } finally {
    decoded.release();
  }
}

/** Пропорция карточки товара (ширина / высота) — портрет 4:5. */
export const CARD_ASPECT = 4 / 5;

/**
 * Прямоугольник центрального кропа под заданную пропорцию (width / height).
 * Не увеличивает исходник: `sw/sh` всегда ≤ исходных размеров.
 */
export function cropRect(
  srcWidth: number,
  srcHeight: number,
  aspect: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const srcAspect = srcWidth / srcHeight;
  if (srcAspect > aspect) {
    // Шире целевой — режем бока.
    const sw = Math.round(srcHeight * aspect);
    return { sx: Math.round((srcWidth - sw) / 2), sy: 0, sw, sh: srcHeight };
  }
  // Уже/равно целевой — режем верх/низ.
  const sh = Math.round(srcWidth / aspect);
  return { sx: 0, sy: Math.round((srcHeight - sh) / 2), sw: srcWidth, sh };
}

/**
 * Нормализация фото: центральный кроп под пропорцию `aspect` с ресайзом до
 * заданной ширины (WebP/JPEG). Высота считается из пропорции.
 */
export async function prepareCroppedImage(
  file: File,
  width: number,
  aspect: number,
  quality = 0.75,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const decoded = await decodeImage(file);
  try {
    const { sx, sy, sw, sh } = cropRect(decoded.width, decoded.height, aspect);
    const outWidth = Math.max(1, Math.min(width, sw));
    const outHeight = Math.max(1, Math.round(outWidth / aspect));
    return await renderToFile(decoded.source, sx, sy, sw, sh, outWidth, outHeight, file.name, quality);
  } finally {
    decoded.release();
  }
}

/** Квадратная нормализация (обложки категорий). */
export function prepareSquareImage(file: File, size = 1000, quality = 0.75): Promise<File> {
  return prepareCroppedImage(file, size, 1, quality);
}

/** Портретная нормализация карточки товара (4:5) — full и thumb. */
export function prepareCardImage(file: File, width: number, quality = 0.75): Promise<File> {
  return prepareCroppedImage(file, width, CARD_ASPECT, quality);
}

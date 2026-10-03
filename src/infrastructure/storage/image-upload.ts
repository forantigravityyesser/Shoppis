import { uploadFile } from './file-storage';
import { prepareCardImage, prepareSquareImage } from '../../utils/image';

/** Ширина полного изображения товара (4:5 → 1000×1250). */
export const FULL_IMAGE_WIDTH = 1000;
/** Ширина миниатюры товара (4:5 → 512×640). */
export const THUMB_IMAGE_WIDTH = 512;
/** Обложка категории — квадрат, показывается мелко. */
export const CATEGORY_COVER_SIZE = 320;

export interface UploadedCatalogImage {
  /** Публичный URL полного изображения. */
  url: string;
  /** Публичный URL миниатюры. */
  thumbUrl: string;
}

/**
 * Готовит портретные 4:5 full (1000×1250) и thumb (512×640) и грузит оба в Storage.
 * Благодаря параллельной загрузке время почти не отличается от одной.
 */
export async function uploadCatalogImage(file: File): Promise<UploadedCatalogImage> {
  const [full, thumb] = await Promise.all([
    prepareCardImage(file, FULL_IMAGE_WIDTH),
    prepareCardImage(file, THUMB_IMAGE_WIDTH),
  ]);
  const [url, thumbUrl] = await Promise.all([uploadFile(full), uploadFile(thumb)]);
  return { url, thumbUrl };
}

/** Обложка категории: только компактная квадратная версия. Возвращает публичный URL. */
export async function uploadCategoryCover(file: File): Promise<string> {
  return uploadFile(await prepareSquareImage(file, CATEGORY_COVER_SIZE));
}

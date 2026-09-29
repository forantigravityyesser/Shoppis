import { uploadFile } from './file-storage';
import { prepareSquareImage } from '../../utils/image';

/** Полноразмерное изображение товара (hero/галерея). */
export const FULL_IMAGE_SIZE = 1000;
/** Миниатюра товара (списки/мини-карточки). */
export const THUMB_IMAGE_SIZE = 320;
/** Обложка категории — везде показывается мелко, нужна только лёгкая версия. */
export const CATEGORY_COVER_SIZE = 320;

export interface UploadedCatalogImage {
  /** Публичный URL полного изображения. */
  url: string;
  /** Публичный URL миниатюры. */
  thumbUrl: string;
}

/**
 * Готовит квадраты full (1000) и thumb (320) и загружает оба в Storage.
 * Благодаря параллельной загрузке время почти не отличается от одной.
 */
export async function uploadCatalogImage(file: File): Promise<UploadedCatalogImage> {
  const [full, thumb] = await Promise.all([
    prepareSquareImage(file, FULL_IMAGE_SIZE),
    prepareSquareImage(file, THUMB_IMAGE_SIZE),
  ]);
  const [url, thumbUrl] = await Promise.all([uploadFile(full), uploadFile(thumb)]);
  return { url, thumbUrl };
}

/** Обложка категории: только компактная квадратная версия. Возвращает публичный URL. */
export async function uploadCategoryCover(file: File): Promise<string> {
  return uploadFile(await prepareSquareImage(file, CATEGORY_COVER_SIZE));
}

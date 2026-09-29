import type { InventoryImageItem } from '../read-models/inventory-view';
import { deps } from '../composition/container';

/** Параллелизм загрузки файлов: компромисс между скоростью и нагрузкой на сеть/память. */
const UPLOAD_CONCURRENCY = 2;

/**
 * Use Case загрузки фото каталога. Единственная точка входа для presentation:
 * компоненты отдают File[] и получают готовые публичные URL, не зная про Storage.
 *
 * Ограничивает параллелизм (2), сохраняя порядок, и при сбое партии удаляет уже
 * загруженные файлы — чтобы не плодить «сирот» в Storage.
 */
export async function uploadCatalogImages(files: File[]): Promise<InventoryImageItem[]> {
  const { imageUpload, storage } = deps();
  const uploaded: InventoryImageItem[] = [];
  try {
    for (let i = 0; i < files.length; i += UPLOAD_CONCURRENCY) {
      const settled = await Promise.allSettled(
        files.slice(i, i + UPLOAD_CONCURRENCY).map((file) => imageUpload.uploadCatalogImage(file)),
      );
      const failed = settled.some((r) => r.status === 'rejected');
      for (const result of settled) {
        if (result.status === 'fulfilled') uploaded.push(result.value);
      }
      if (failed) throw new Error('photo upload failed');
    }
    return uploaded;
  } catch (e) {
    void storage.removeFilesByUrl(uploaded.flatMap((img) => [img.url, img.thumbUrl]));
    throw e;
  }
}

/** Обложка категории: компактный квадрат, возвращает публичный URL. */
export function uploadCategoryCoverImage(file: File): Promise<string> {
  return deps().imageUpload.uploadCategoryCover(file);
}

/** Загрузка/удаление файлов в публичном бакете. */
export interface StoragePort {
  uploadFile(file: File): Promise<string>;
  removeFilesByUrl(urls: Array<string | null | undefined>): Promise<void>;
  /**
   * Публичный **JPEG**-URL изображения товара для шаринга в Telegram (WebP →
   * перекодирование + кэш). `null` — подготовить не удалось (шаринг без фото).
   */
  ensureShareImage(productId: string, imageUrl: string): Promise<string | null>;
}

/** Подготовка и загрузка производных изображений (full/thumb/обложка/баннер). */
export interface ImageUploadPort {
  uploadCatalogImage(file: File): Promise<{ url: string; thumbUrl: string }>;
  uploadCategoryCover(file: File): Promise<string>;
  uploadBannerImage(file: File): Promise<string>;
}

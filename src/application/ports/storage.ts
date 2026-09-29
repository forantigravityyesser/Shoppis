/** Загрузка/удаление файлов в публичном бакете. */
export interface StoragePort {
  uploadFile(file: File): Promise<string>;
  removeFilesByUrl(urls: Array<string | null | undefined>): Promise<void>;
}

/** Подготовка и загрузка производных изображений (full/thumb/обложка). */
export interface ImageUploadPort {
  uploadCatalogImage(file: File): Promise<{ url: string; thumbUrl: string }>;
  uploadCategoryCover(file: File): Promise<string>;
}

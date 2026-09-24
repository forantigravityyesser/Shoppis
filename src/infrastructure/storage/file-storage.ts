import { insforge } from '../insforge/client';
import { MEDIA_BUCKET } from '../insforge/config';

/** Загрузка в публичный бакет shoppis-media. Возвращает публичный URL. */
export async function uploadFile(file: File): Promise<string> {
  const key = `${Date.now()}-${file.name}`;
  const { data, error } = await insforge.storage.from(MEDIA_BUCKET).upload(key, file);
  if (error || !data) throw error ?? new Error('Upload failed');
  return data.url;
}

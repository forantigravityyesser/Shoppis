import { insforge } from '../insforge/client';
import { MEDIA_BUCKET } from '../insforge/config';

/**
 * Загрузка в публичный бакет shoppis-media с авто-уникальным ключом.
 * Возвращает публичный URL — его и сохраняем в БД.
 */
export async function uploadFile(file: File): Promise<string> {
  const { data, error } = await insforge.storage.from(MEDIA_BUCKET).uploadAuto(file);
  if (error || !data) throw error ?? new Error('Upload failed');
  return data.url;
}

/**
 * Публичный URL → storage key. Если передан уже key (без URL-маркера) — возвращаем как есть.
 * Публичный URL содержит cache-busting `?v=<hash>` — его нужно отбросить, иначе удаление
 * ищет объект с несуществующим ключом.
 */
function storageKeyFromUrl(value: string): string {
  const marker = '/objects/';
  const index = value.indexOf(marker);
  if (index === -1) return value;
  const rest = value.slice(index + marker.length);
  const end = rest.search(/[?#]/);
  const encoded = end === -1 ? rest : rest.slice(0, end);
  return decodeURIComponent(encoded);
}

/**
 * Удаляет файл из публичного бакета по его публичному URL (или storage key).
 * Используется при удалении сущностей (например, обложки категории).
 */
export async function removeFileByUrl(urlOrKey: string): Promise<void> {
  const key = storageKeyFromUrl(urlOrKey);
  if (!key) return;
  const { error } = await insforge.storage.from(MEDIA_BUCKET).remove(key);
  if (error) throw error;
}

/**
 * Массовое удаление файлов (best-effort): дедуп, null/undefined игнорируются,
 * один батч-запрос к Storage, ошибки логируются и не пробрасываются.
 */
export async function removeFilesByUrl(urls: Array<string | null | undefined>): Promise<void> {
  const keys = Array.from(
    new Set(urls.filter((u): u is string => Boolean(u)).map(storageKeyFromUrl)),
  ).filter(Boolean);
  if (!keys.length) return;
  try {
    const bucket = insforge.storage.from(MEDIA_BUCKET);
    const { error } = keys.length === 1 ? await bucket.remove(keys[0]) : await bucket.remove(keys);
    if (error) throw error;
  } catch (e) {
    console.warn('[storage] failed to remove objects', keys, e);
  }
}

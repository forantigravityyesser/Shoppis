import { useEffect, useSyncExternalStore } from 'react';

/**
 * Локальный трекинг «просмотренных» отзывов продавца по товарам.
 *
 * Задача (docs/19 §24–27, правка заказчика): в seller-карточке товара вкладка «Отзывы»
 * показывает бейдж непрочитанных; при заходе на вкладку отзывы помечаются прочитанными.
 * Для вопросов «просмотрен» = есть ответ, поэтому отдельного хранилища не требуется.
 *
 * Храним только id уже просмотренных отзывов (localStorage, per product). Это UI-состояние
 * продавца, не домен; при недоступности storage деградируем в память сессии.
 */

const STORAGE_PREFIX = 'shoppis:seller:seenReviews:';
const EMPTY: ReadonlySet<string> = new Set<string>();

const cache = new Map<string, Set<string>>();
const listeners = new Set<() => void>();

function storageKey(productId: string): string {
  return `${STORAGE_PREFIX}${productId}`;
}

function read(productId: string): Set<string> {
  const cached = cache.get(productId);
  if (cached) return cached;

  let ids: string[] = [];
  try {
    const raw = localStorage.getItem(storageKey(productId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === 'string');
    }
  } catch {
    ids = [];
  }

  const set = new Set(ids);
  cache.set(productId, set);
  return set;
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Помечает переданные отзывы прочитанными (идемпотентно, без записи при отсутствии изменений). */
export function markReviewsSeen(productId: string, reviewIds: string[]): void {
  if (!productId || reviewIds.length === 0) return;

  const current = read(productId);
  const next = new Set(current);
  let changed = false;
  for (const id of reviewIds) {
    if (!next.has(id)) {
      next.add(id);
      changed = true;
    }
  }
  if (!changed) return;

  cache.set(productId, next);
  try {
    localStorage.setItem(storageKey(productId), JSON.stringify([...next]));
  } catch {
    /* storage недоступен — состояние живёт в памяти сессии */
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Синхронный снимок просмотренных id (для тестов и вычислений). */
export function seenReviewIds(productId: string): ReadonlySet<string> {
  return productId ? read(productId) : EMPTY;
}

/** Id отзывов товара, которые продавец ещё не открывал. */
export function unseenReviewIds(productId: string, reviewIds: string[]): Set<string> {
  const seen = seenReviewIds(productId);
  return new Set(reviewIds.filter((id) => !seen.has(id)));
}

/** Реактивный список просмотренных отзывов товара. */
export function useSeenReviewIds(productId: string | null): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => (productId ? read(productId) : EMPTY),
    () => EMPTY,
  );
}

/** Побочный эффект открытия вкладки «Отзывы»: помечает текущий список прочитанным. */
export function useMarkReviewsSeen(productId: string | null, reviewIds: string[]): void {
  useEffect(() => {
    if (!productId) return;
    markReviewsSeen(productId, reviewIds);
  }, [productId, reviewIds]);
}

import type { StoreCurrency, StoreLanguage, StoreStatus } from '../models/store';

/** Допустимые значения домена. Источник — типы в `domain/models/store.ts`. */
export const STORE_CURRENCIES: readonly StoreCurrency[] = ['USD', 'RUB', 'BYN'];
export const STORE_LANGUAGES: readonly StoreLanguage[] = ['ru', 'en'];
export const STORE_STATUSES: readonly StoreStatus[] = ['ACTIVE', 'PAUSED'];

export function isValidCurrency(value: unknown): value is StoreCurrency {
  return (STORE_CURRENCIES as readonly string[]).includes(value as string);
}

export function isValidLanguage(value: unknown): value is StoreLanguage {
  return (STORE_LANGUAGES as readonly string[]).includes(value as string);
}

export function isValidStatus(value: unknown): value is StoreStatus {
  return (STORE_STATUSES as readonly string[]).includes(value as string);
}

/** Нормализация названия магазина: обрезаем внешние пробелы. */
export function normalizeStoreName(name: string): string {
  return String(name ?? '').trim();
}

/** Валидация названия: возвращает текст ошибки или null, если значение корректно. */
export function validateStoreName(name: string): string | null {
  return normalizeStoreName(name) ? null : 'Название магазина обязательно';
}

/**
 * Пуст ли profile patch: сохранять нечего, если ни одно поле блока не задано.
 * Структурный тип — чтобы не тянуть application-контракт в domain.
 */
export function isProfilePatchEmpty(patch: {
  name?: unknown;
  bannerUrl?: unknown;
  currency?: unknown;
  language?: unknown;
  supportHandle?: unknown;
}): boolean {
  return [patch.name, patch.bannerUrl, patch.currency, patch.language, patch.supportHandle].every(
    (value) => value === undefined,
  );
}

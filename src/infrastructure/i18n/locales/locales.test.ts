import { describe, expect, it } from 'vitest';
import en from './en.json';
import ru from './ru.json';

/** Плюральные суффиксы CLDR — сводим к базовому ключу при сравнении. */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Плоский список листовых ключей вида `seller.settings.title`. */
function leafKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix.replace(PLURAL_SUFFIX, '')];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

/** Уникальный отсортированный набор базовых ключей локали. */
function keySet(locale: unknown): string[] {
  return [...new Set(leafKeys(locale))].sort();
}

describe('locales parity', () => {
  it('ru и en имеют одинаковый набор базовых ключей', () => {
    expect(keySet(en)).toEqual(keySet(ru));
  });

  it('нет пустых строковых значений', () => {
    const empty = leafKeys(ru).filter((key) => key === '');
    expect(empty).toEqual([]);
  });
});

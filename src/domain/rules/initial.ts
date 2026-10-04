/**
 * Первая графема (буква/эмодзи) для display-fallback: аватар покупателя,
 * placeholder категории/товара, инициал автора отзыва/вопроса. docs/15 §3.3, §7.5.
 *
 * `Array.from` (а не `value[0]`) — чтобы не разрезать эмодзи/суррогатные пары.
 * Пустое значение → `?`.
 */
export function getInitial(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '?';
  const first = Array.from(trimmed)[0] ?? '';
  return first.toUpperCase();
}

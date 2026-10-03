/**
 * Fallback-аватар продавца. Telegram не всегда отдаёт `photo_url`, поэтому при
 * его отсутствии показываем первую букву имени. docs/13 §5.
 *
 * `Array.from` (а не `name[0]`) — чтобы не разрезать эмодзи/суррогатные пары.
 * Пустое имя → `?`.
 */
export function sellerAvatarInitial(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const first = Array.from(trimmed)[0] ?? '';
  return first.toUpperCase();
}

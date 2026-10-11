/** Форматирование дат заказа для списка/деталей (buyer + seller). */

function toDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Дата без времени (например, «10 октября 2026 г.»). */
export function formatOrderDate(iso: string): string {
  const date = toDate(iso);
  if (!date) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Дата и время (деталь заказа). */
export function formatOrderDateTime(iso: string): string {
  const date = toDate(iso);
  if (!date) return '';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

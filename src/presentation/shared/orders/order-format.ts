import { formatLongDate, formatLongDateTime } from '../format-date';

/** Форматирование дат заказа для списка/деталей (buyer + seller). */

/** Дата без времени (например, «10 октября 2026 г.»). */
export function formatOrderDate(iso: string): string {
  return formatLongDate(iso);
}

/** Дата и время (деталь заказа). */
export function formatOrderDateTime(iso: string): string {
  return formatLongDateTime(iso);
}

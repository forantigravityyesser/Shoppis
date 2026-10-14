import i18n from 'i18next';

/** Форматирование дат в локали активного языка интерфейса (buyer + seller + shared). */

/** Активная локаль форматирования (совпадает с языком интерфейса). */
function locale(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? 'ru';
}

/** Дата без времени (например, «10 октября 2026 г.» / «October 10, 2026»). */
export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Дата и время. */
export function formatLongDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

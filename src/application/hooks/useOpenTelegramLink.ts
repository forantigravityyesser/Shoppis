import { deps } from '../composition/container';

/**
 * Открытие t.me-ссылок внутри Telegram (например, предпросмотр витрины).
 * presentation не зависит от infrastructure — доступ идёт через порт.
 * Возвращает `false`, если открыть не удалось (для показа ошибки).
 */
export function useOpenTelegramLink(): (url: string) => boolean {
  return (url: string) => deps().telegram.openTelegramLink(url);
}

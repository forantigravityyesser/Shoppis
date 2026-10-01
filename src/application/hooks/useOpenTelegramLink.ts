import { deps } from '../composition/container';

/**
 * Открытие t.me-ссылок внутри Telegram (например, предпросмотр витрины).
 * presentation не зависит от infrastructure — доступ идёт через порт.
 */
export function useOpenTelegramLink(): (url: string) => void {
  return (url: string) => deps().telegram.openTelegramLink(url);
}

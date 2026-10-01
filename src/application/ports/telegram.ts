/** Платформенные возможности Telegram Mini App, используемые приложением. */
export interface TelegramPort {
  getStartParam(): string | null;
  /** Username buyer-бота (без `@`) для публичных ссылок на витрину. */
  getBuyerBotUsername(): string;
  /** Короткое имя buyer Mini App; при наличии даёт прямую ссылку на приложение. */
  getBuyerAppShortname(): string;
  /** Открыть telegram-ссылку (t.me) внутри Telegram; вне Telegram — безопасный fallback. */
  openTelegramLink(url: string): void;
  /**
   * Официальный запрос «Разрешить боту отправлять сообщения?».
   *
   * BEST-EFFORT: результат совещательный (`true` — разрешено). Реализация
   * обязана всегда резолвиться boolean за ограниченное время и никогда не
   * бросать/не виснуть. Бизнес-логика (например, оформление заказа) не должна
   * зависеть от результата.
   */
  requestMessagesAccess(): Promise<boolean>;
}

/** Тактильная отдача. Вне Telegram — безопасный no-op. */
export interface HapticsPort {
  impactLight(): void;
  impactMedium(): void;
  notifySuccess(): void;
  selectTick(): void;
}

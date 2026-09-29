/** Платформенные возможности Telegram Mini App, используемые приложением. */
export interface TelegramPort {
  getStartParam(): string | null;
  /** Официальный запрос «Разрешить боту отправлять сообщения?». true — разрешено. */
  requestMessagesAccess(): Promise<boolean>;
}

/** Тактильная отдача. Вне Telegram — безопасный no-op. */
export interface HapticsPort {
  impactLight(): void;
  impactMedium(): void;
  notifySuccess(): void;
  selectTick(): void;
}

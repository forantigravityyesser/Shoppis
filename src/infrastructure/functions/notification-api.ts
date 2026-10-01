import { invokeFunction } from '../insforge/functions-gateway';

interface NotificationResponse {
  success?: boolean;
  error?: string;
}

/** opt-in Telegram-уведомлений: фиксирует согласие покупателя на сервере. */
export async function enableTelegramNotifications(token: string): Promise<void> {
  const { data, error } = await invokeFunction<NotificationResponse>('notifications-actions', {
    body: { action: 'enable' },
    token,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Notification update failed');
}

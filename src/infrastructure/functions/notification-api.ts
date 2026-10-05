import { invokeFunction } from '../insforge/functions-gateway';

interface NotificationResponse {
  success?: boolean;
  error?: string;
}

/**
 * opt-in Telegram-уведомлений: фиксирует согласие покупателя на сервере.
 * Если передан `orderId`, сервер дополнительно досылает «Заказ принят» боту
 * покупателя для этого заказа (первый заказ создаётся до получения согласия).
 */
export async function enableTelegramNotifications(token: string, orderId?: string): Promise<void> {
  const { data, error } = await invokeFunction<NotificationResponse>('notifications-actions', {
    body: orderId ? { action: 'enable', orderId } : { action: 'enable' },
    token,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Notification update failed');
}

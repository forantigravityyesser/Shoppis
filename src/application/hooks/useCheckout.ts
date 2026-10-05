import { useCallback, useState } from 'react';
import type { RecipientInfo } from '../../domain/models/customer';
import type { ServerUser } from '../contracts/auth';
import type { CheckoutResult } from '../contracts/checkout';
import {
  sanitizePhoneInput,
  validateRecipient,
  type CheckoutRecipientValidation,
} from '../../domain/rules/checkout-rules';
import { useStore } from '../store';

/**
 * Оформление заказа (docs/18 §23–§26). Application-оркестрация формы: поля
 * получателя (ФИО / телефон / адрес доставки), валидация, отправка и результат.
 * UI-логики нет — presentation только рендерит состояние и зовёт `submit`.
 *
 * Порядок `submit` важен: запрос разрешения Telegram вызывается **синхронно в
 * жесте клика** (до каких-либо `await`), чтобы система показала промпт; сам заказ
 * от разрешения не зависит. Сервер перепроверяет цену/остаток и создаёт заказ
 * атомарно; клиентские данные недоверенные.
 */

export type CheckoutStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface CheckoutFieldPatch {
  name?: string;
  phone?: string;
  address?: string;
}

export interface CheckoutState {
  recipient: RecipientInfo;
  validation: CheckoutRecipientValidation;
  status: CheckoutStatus;
  /** Сообщение об ошибке оформления (уже локализованное), null — ошибки нет. */
  error: string | null;
  /** Результат последнего успешного заказа — для экрана успеха. */
  lastOrder: CheckoutResult | null;
  /** Разрешение на сообщения бота получено (best-effort). */
  notificationsGranted: boolean;
  /** Идёт запрос write-access у Telegram (кнопка «Разрешить»). */
  notificationsPending: boolean;
  setField: (patch: CheckoutFieldPatch) => void;
  submit: () => Promise<void>;
  /** Запросить разрешение уведомлений и дослать «Заказ принят» (по `orderId`). */
  enableNotifications: (orderId?: string) => Promise<void>;
  /** Сбросить форму и результат (например, после закрытия экрана успеха). */
  reset: () => void;
}

const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  STORE_PAUSED: 'Магазин временно недоступен для оформления заказов.',
  STORE_NOT_FOUND: 'Магазин не найден. Обновите страницу.',
  INSUFFICIENT_STOCK: 'Недостаточно товара. Проверьте количество.',
  PRODUCT_NOT_ACTIVE: 'Товар больше недоступен. Обновите корзину.',
  VARIANT_NOT_FOUND: 'Товар изменился. Обновите корзину.',
  FOREIGN_VARIANT: 'Товар изменился. Обновите корзину.',
  INVENTORY_NOT_FOUND: 'Товар больше недоступен. Обновите корзину.',
  INVALID_QUANTITY: 'Проверьте количество товаров.',
  EMPTY_CART: 'Корзина пуста.',
  UNAUTHORIZED: 'Сессия истекла. Откройте приложение заново.',
  NETWORK: 'Не удалось оформить заказ. Проверьте соединение.',
  UNKNOWN: 'Не удалось оформить заказ. Попробуйте ещё раз.',
};

/** Маппинг кода/сообщения ошибки checkout в понятный текст (docs/18 §32). */
export function mapCheckoutError(raw: string): string {
  const message = String(raw ?? '');
  const code = Object.keys(CHECKOUT_ERROR_MESSAGES).find(
    (key) => key !== 'NETWORK' && key !== 'UNKNOWN' && message.includes(key),
  );
  if (code) return CHECKOUT_ERROR_MESSAGES[code];
  if (/network|fetch|timeout|offline/i.test(message)) return CHECKOUT_ERROR_MESSAGES.NETWORK;
  return CHECKOUT_ERROR_MESSAGES.UNKNOWN;
}

/** Стартовое заполнение: сохранённый получатель + имя из Telegram. */
function initialRecipient(def: RecipientInfo, user: ServerUser | null): RecipientInfo {
  return {
    name: def.name.trim() || user?.firstName || '',
    phone: def.phone ?? '',
    address: def.address ?? '',
  };
}

export function useCheckout(): CheckoutState {
  const defaultRecipient = useStore((s) => s.defaultRecipient);
  const serverUser = useStore((s) => s.serverUser);
  const placeOrder = useStore((s) => s.placeOrder);
  const requestNotifications = useStore((s) => s.requestNotifications);
  const setDefaultRecipient = useStore((s) => s.setDefaultRecipient);
  const userSettings = useStore((s) => s.userSettings);
  const setUserSettings = useStore((s) => s.setUserSettings);
  const lastOrder = useStore((s) => s.lastOrder);
  const { notifications: notificationsEnabled } = userSettings;

  const [recipient, setRecipient] = useState<RecipientInfo>(() =>
    initialRecipient(defaultRecipient, serverUser),
  );
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notificationsGranted, setNotificationsGranted] = useState(notificationsEnabled);
  const [notificationsPending, setNotificationsPending] = useState(false);

  const validation = validateRecipient(recipient);

  const setField = useCallback((patch: CheckoutFieldPatch) => {
    setRecipient((prev) => ({
      name: patch.name ?? prev.name,
      phone: patch.phone !== undefined ? sanitizePhoneInput(patch.phone) : prev.phone,
      address: patch.address ?? prev.address,
    }));
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (status === 'submitting') return;
    if (!validateRecipient(recipient).valid) {
      setStatus('error');
      setError('Заполните все поля');
      return;
    }

    setStatus('submitting');
    setError(null);

    // Заказ (сервер сам перепроверяет цену/остаток и создаёт атомарно).
    // Разрешение на уведомления здесь НЕ спрашиваем: его берём на экране успеха
    // по тапу, там же досылаем «Заказ принят» (Telegram-попап требует решения
    // человека и не должен блокировать оформление).
    try {
      await placeOrder(recipient);
      setDefaultRecipient(recipient);
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setError(mapCheckoutError((e as Error).message));
    }
  }, [status, recipient, placeOrder, setDefaultRecipient]);

  const enableNotifications = useCallback(
    async (orderId?: string) => {
      if (notificationsPending) return;
      setNotificationsPending(true);
      try {
        const granted = await requestNotifications(orderId);
        setNotificationsGranted(granted);
        if (granted) {
          setUserSettings({ notifications: true, notificationsPrompted: true });
        }
      } catch {
        // write-access — best-effort, на заказ не влияет.
      } finally {
        setNotificationsPending(false);
      }
    },
    [notificationsPending, requestNotifications, setUserSettings],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setNotificationsGranted(notificationsEnabled);
    setRecipient(initialRecipient(defaultRecipient, serverUser));
    useStore.getState().resetCheckout();
  }, [defaultRecipient, serverUser, notificationsEnabled]);

  return {
    recipient,
    validation,
    status,
    error,
    lastOrder,
    notificationsGranted,
    notificationsPending,
    setField,
    submit,
    enableNotifications,
    reset,
  };
}

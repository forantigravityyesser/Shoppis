import { useCallback, useRef, useState } from 'react';
import i18n from 'i18next';
import { useQueryClient } from '@tanstack/react-query';
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

/** i18n-ключи ошибок checkout по машинному коду (docs/18 §32). */
const CHECKOUT_ERROR_KEYS = {
  STORE_PAUSED: 'errors.checkout.STORE_PAUSED',
  STORE_NOT_FOUND: 'errors.checkout.STORE_NOT_FOUND',
  INSUFFICIENT_STOCK: 'errors.checkout.INSUFFICIENT_STOCK',
  PRODUCT_NOT_ACTIVE: 'errors.checkout.PRODUCT_NOT_ACTIVE',
  VARIANT_NOT_FOUND: 'errors.checkout.VARIANT_NOT_FOUND',
  FOREIGN_VARIANT: 'errors.checkout.FOREIGN_VARIANT',
  INVENTORY_NOT_FOUND: 'errors.checkout.INVENTORY_NOT_FOUND',
  INVALID_QUANTITY: 'errors.checkout.INVALID_QUANTITY',
  EMPTY_CART: 'errors.checkout.EMPTY_CART',
  VARIANT_DUPLICATE: 'errors.checkout.VARIANT_DUPLICATE',
  INVALID_CART_ITEM: 'errors.checkout.INVALID_CART_ITEM',
  IDEMPOTENCY_KEY_REQUIRED: 'errors.checkout.IDEMPOTENCY_KEY_REQUIRED',
  UNAUTHORIZED: 'errors.checkout.UNAUTHORIZED',
  NETWORK: 'errors.checkout.NETWORK',
  UNKNOWN: 'errors.checkout.UNKNOWN',
} as const;

/** Машинный код ошибки checkout из сырого сообщения (docs/18 §32), null если не распознан. */
export function checkoutErrorCode(raw: string): string | null {
  const message = String(raw ?? '');
  return (
    Object.keys(CHECKOUT_ERROR_KEYS).find(
      (key) => key !== 'NETWORK' && key !== 'UNKNOWN' && message.includes(key),
    ) ?? null
  );
}

/** Коды, означающие, что состояние корзины устарело → нужен пере-запрос/reconcile (docs/21 §3.6). */
const RECONCILE_ERROR_CODES = new Set([
  'INSUFFICIENT_STOCK',
  'PRODUCT_NOT_ACTIVE',
  'VARIANT_NOT_FOUND',
  'FOREIGN_VARIANT',
  'INVENTORY_NOT_FOUND',
  'STORE_PAUSED',
]);

/** Маппинг кода/сообщения ошибки checkout в понятный текст (docs/18 §32). */
export function mapCheckoutError(raw: string): string {
  const message = String(raw ?? '');
  const code = checkoutErrorCode(message);
  if (code) return i18n.t(CHECKOUT_ERROR_KEYS[code as keyof typeof CHECKOUT_ERROR_KEYS]);
  if (/network|fetch|timeout|offline/i.test(message)) return i18n.t(CHECKOUT_ERROR_KEYS.NETWORK);
  return i18n.t(CHECKOUT_ERROR_KEYS.UNKNOWN);
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
  const queryClient = useQueryClient();
  const defaultRecipient = useStore((s) => s.defaultRecipient);
  const serverUser = useStore((s) => s.serverUser);
  const placeOrder = useStore((s) => s.placeOrder);
  const requestNotifications = useStore((s) => s.requestNotifications);
  const setDefaultRecipient = useStore((s) => s.setDefaultRecipient);
  const setNotificationsEnabled = useStore((s) => s.setNotificationsEnabled);
  const lastOrder = useStore((s) => s.lastOrder);
  // Согласие на уведомления — серверный факт из сессии, а НЕ локальный persist:
  // иначе сброс флага в БД не виден клиенту и кнопка «Разрешить» исчезает навсегда.
  const serverNotificationsEnabled = serverUser?.notificationsEnabled ?? false;

  const [recipient, setRecipient] = useState<RecipientInfo>(() =>
    initialRecipient(defaultRecipient, serverUser),
  );
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notificationsGranted, setNotificationsGranted] = useState(serverNotificationsEnabled);
  const [notificationsPending, setNotificationsPending] = useState(false);
  // Idempotency текущей checkout-попытки (docs/21 §3.1): генерируется лениво при
  // первом submit и переиспользуется при повторе, чтобы потерянный ответ/ретрай
  // не создал второй заказ; сбрасывается при успехе и `reset`.
  const idempotencyKeyRef = useRef<string | null>(null);

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

    // Ключ создаётся один раз на попытку и переиспользуется при повторе
    // (docs/21 §3.1): network-timeout + повтор не должны создать второй заказ.
    const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;

    // Заказ (сервер сам перепроверяет цену/остаток и создаёт атомарно).
    // Разрешение на уведомления здесь НЕ спрашиваем: его берём на экране успеха
    // по тапу, там же досылаем «Заказ принят» (Telegram-попап требует решения
    // человека и не должен блокировать оформление).
    try {
      await placeOrder(recipient, idempotencyKey);
      idempotencyKeyRef.current = null;
      // Новый заказ → обновляем server-cache списка заказов (docs/22 ORD-04):
      // list живёт в React Query, отдельного post-checkout refresh в slice больше нет.
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      setDefaultRecipient(recipient);
      setStatus('success');
    } catch (e) {
      const raw = (e as Error).message;
      setStatus('error');
      setError(mapCheckoutError(raw));
      // Конфликт стока/товара/магазина → состояние корзины устарело: перечитываем
      // `buyer-cart`, чтобы реконсиляция привела UI в актуальный вид (docs/21 §3.6).
      const code = checkoutErrorCode(raw);
      if (code && RECONCILE_ERROR_CODES.has(code)) {
        void queryClient.invalidateQueries({ queryKey: ['buyer-cart'] });
      }
    }
  }, [status, recipient, placeOrder, setDefaultRecipient, queryClient]);

  const enableNotifications = useCallback(
    async (orderId?: string) => {
      if (notificationsPending) return;
      setNotificationsPending(true);
      try {
        const granted = await requestNotifications(orderId);
        setNotificationsGranted(granted);
        if (granted) {
          // Согласие записано на сервере (`notifications-actions`) — отражаем в сессии.
          setNotificationsEnabled(true);
        }
      } catch {
        // write-access — best-effort, на заказ не влияет.
      } finally {
        setNotificationsPending(false);
      }
    },
    [notificationsPending, requestNotifications, setNotificationsEnabled],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setNotificationsGranted(serverNotificationsEnabled);
    setRecipient(initialRecipient(defaultRecipient, serverUser));
    idempotencyKeyRef.current = null;
    useStore.getState().resetCheckout();
  }, [defaultRecipient, serverUser, serverNotificationsEnabled]);

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

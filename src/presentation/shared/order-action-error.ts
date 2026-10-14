import i18n from 'i18next';

/** i18n-ключи для кодов ошибок edge `order-actions` (docs/22 §5.7). */
const ORDER_ACTION_ERROR_KEYS = {
  ORDER_NOT_FOUND: 'errors.orderAction.notFound',
  ORDER_TERMINAL: 'errors.orderAction.terminal',
  CANCEL_NOT_ALLOWED: 'errors.orderAction.cancelNotAllowed',
  TRANSITION_NOT_ALLOWED: 'errors.orderAction.transitionNotAllowed',
  NOT_DELIVERED: 'errors.orderAction.notDelivered',
  OUTCOME_ALREADY_RECORDED: 'errors.orderAction.outcomeAlreadyRecorded',
  INVALID_OUTCOME: 'errors.orderAction.invalidOutcome',
  REASON_REQUIRED: 'errors.orderAction.reasonRequired',
  INVALID_REFUSAL_REASON: 'errors.orderAction.invalidRefusalReason',
  INVALID_QUANTITY: 'errors.orderAction.invalidQuantity',
  FORBIDDEN: 'errors.orderAction.forbidden',
  UNAUTHORIZED: 'errors.orderAction.unauthorized',
} as const;

/** Маппинг сырого сообщения/кода ошибки команды заказа в понятный текст. */
export function orderActionErrorMessage(raw: string | null | undefined): string {
  const message = String(raw ?? '');
  const code = (
    Object.keys(ORDER_ACTION_ERROR_KEYS) as Array<keyof typeof ORDER_ACTION_ERROR_KEYS>
  ).find((key) => message.includes(key));
  if (code) return i18n.t(ORDER_ACTION_ERROR_KEYS[code]);
  if (/network|fetch|timeout|offline/i.test(message)) {
    return i18n.t('errors.orderAction.network');
  }
  return i18n.t('errors.orderAction.fallback');
}

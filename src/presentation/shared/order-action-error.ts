/** Человекочитаемые сообщения для кодов ошибок edge `order-actions` (docs/22 §5.7). */
const ORDER_ACTION_ERRORS: Record<string, string> = {
  ORDER_NOT_FOUND: 'Заказ не найден.',
  ORDER_TERMINAL: 'Заказ уже завершён — действие недоступно.',
  CANCEL_NOT_ALLOWED: 'Этот заказ уже нельзя отменить.',
  TRANSITION_NOT_ALLOWED: 'Это действие сейчас недоступно.',
  NOT_DELIVERED: 'Заказ ещё не доставлен.',
  OUTCOME_ALREADY_RECORDED: 'Результат доставки уже зафиксирован.',
  INVALID_OUTCOME: 'Некорректный результат доставки.',
  REASON_REQUIRED: 'Укажите причину.',
  INVALID_REFUSAL_REASON: 'Некорректная причина отказа.',
  INVALID_QUANTITY: 'Некорректное количество.',
  FORBIDDEN: 'Недостаточно прав для этого действия.',
  UNAUTHORIZED: 'Сессия истекла. Откройте приложение заново.',
};

/** Маппинг сырого сообщения/кода ошибки команды заказа в понятный текст. */
export function orderActionErrorMessage(raw: string | null | undefined): string {
  const message = String(raw ?? '');
  const code = Object.keys(ORDER_ACTION_ERRORS).find((key) => message.includes(key));
  if (code) return ORDER_ACTION_ERRORS[code];
  if (/network|fetch|timeout|offline/i.test(message)) {
    return 'Проверьте соединение и попробуйте снова.';
  }
  return 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

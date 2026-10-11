import { describe, expect, it } from 'vitest';
import { orderActionErrorMessage } from './order-action-error';

describe('orderActionErrorMessage', () => {
  it('маппит известные коды заказа в понятный текст', () => {
    expect(orderActionErrorMessage('CANCEL_NOT_ALLOWED')).toContain('нельзя отменить');
    expect(orderActionErrorMessage('ORDER_TERMINAL')).toContain('завершён');
    expect(orderActionErrorMessage('FORBIDDEN')).toContain('Недостаточно прав');
    expect(orderActionErrorMessage('ORDER_NOT_FOUND')).toContain('не найден');
    expect(orderActionErrorMessage('OUTCOME_ALREADY_RECORDED')).toContain('уже зафиксирован');
    expect(orderActionErrorMessage('INVALID_REFUSAL_REASON')).toContain('причина отказа');
  });

  it('сетевые ошибки → подсказка про соединение', () => {
    expect(orderActionErrorMessage('Network request failed')).toContain('соединение');
  });

  it('неизвестное / пусто → generic', () => {
    expect(orderActionErrorMessage('SOMETHING_ELSE')).toContain('Не удалось выполнить действие');
    expect(orderActionErrorMessage(null)).toContain('Не удалось выполнить действие');
  });
});

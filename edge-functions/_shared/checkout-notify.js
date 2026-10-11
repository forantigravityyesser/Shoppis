// checkout-notify.js — решение о side-effect уведомлениях checkout.
//
// Первый успешный checkout шлёт уведомления покупателю/продавцу; идемпотентный
// ретрай (тот же ключ) возвращает уже созданный заказ и НЕ должен слать их снова
// (docs/24 §2.7 D2 / ORD-HARDEN-07).

/** @returns {boolean} true — слать уведомления (не идемпотентный ретрай). */
export function shouldNotifyCheckout(result) {
  return result?.idempotent !== true;
}

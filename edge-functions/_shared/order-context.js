// order-context.js — загрузка данных заказа для писем-уведомлений (docs/22 §5.10).
//
// Отдаёт номер/сумму/снапшот доставки, публичный контакт магазина и позиции
// (название, вариант/размер, количество, сумма строки). Best-effort: любая
// ошибка/отсутствие → пустые значения, письмо всё равно шлётся (без блока).

/**
 * Позиции заказа как снапшоты (immutable) для письма.
 * @returns {Array<{ title: string, variantLabel: string, quantity: number, lineTotalMinor: number|null }>}
 */
export function mapOrderItems(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    title: row?.product_title_snapshot ?? '',
    // Вариант/размер: "Размер M" (concat_ws), как в read-модели заказа.
    variantLabel: [row?.variant_name_snapshot, row?.variant_value_snapshot]
      .filter((v) => v != null && String(v).trim() !== '')
      .join(' '),
    quantity: Number(row?.quantity) || 0,
    lineTotalMinor: row?.line_total_minor ?? null,
  }));
}

/** Позиции заказа (best-effort, порядок по `id` — порядок оформления). */
export async function loadOrderItems(client, orderId) {
  if (!orderId) return [];
  try {
    const { data } = await client.database
      .from('order_items')
      .select(
        'product_title_snapshot, variant_name_snapshot, variant_value_snapshot, quantity, line_total_minor',
      )
      .eq('order_id', orderId)
      .order('id', { ascending: true });
    return mapOrderItems(data);
  } catch {
    return [];
  }
}

/**
 * Контекст заказа для уведомлений: заказ + магазин + позиции.
 * @returns {Promise<{ order: object|null, store: object|null, items: Array }>}
 */
export async function loadOrderNotificationData(client, orderId) {
  let order = null;
  try {
    const { data } = await client.database
      .from('orders')
      .select(
        'public_order_number, store_id, total_minor, currency_symbol_snapshot, buyer_user_id, ' +
          'buyer_full_name_snapshot, buyer_phone_snapshot, buyer_address_snapshot',
      )
      .eq('id', orderId)
      .maybeSingle();
    order = data ?? null;
  } catch {
    order = null;
  }

  let store = null;
  if (order?.store_id) {
    try {
      const { data } = await client.database
        .from('stores')
        .select('public_id, support_handle, owner_telegram_id, currency_symbol')
        .eq('id', order.store_id)
        .maybeSingle();
      store = data ?? null;
    } catch {
      store = null;
    }
  }

  const items = await loadOrderItems(client, orderId);
  return { order, store, items };
}

/** Снапшот доставки из строки заказа (для писем покупателю, сверка данных). */
export function deliveryFromOrder(order) {
  if (!order) return null;
  const delivery = {
    fullName: order.buyer_full_name_snapshot ?? '',
    phone: order.buyer_phone_snapshot ?? '',
    address: order.buyer_address_snapshot ?? '',
  };
  return delivery.fullName || delivery.phone || delivery.address ? delivery : null;
}

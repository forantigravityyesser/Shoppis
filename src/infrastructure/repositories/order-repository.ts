import { insforge } from '../insforge/client';
import type { Order, OrderItem, OrderStatus } from '../../domain/models/order';

interface OrderRow {
  id: string;
  store_id: string;
  customer_id: string;
  subtotal: number;
  total: number;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  status: OrderStatus;
  created_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  product_variant_id: string | null;
  quantity: number;
  unit_price: number;
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    storeId: row.store_id,
    customerId: row.customer_id,
    subtotal: Number(row.subtotal ?? 0),
    total: Number(row.total ?? 0),
    recipientName: row.recipient_name ?? '',
    recipientPhone: row.recipient_phone ?? '',
    recipientAddress: row.recipient_address ?? '',
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productVariantId: row.product_variant_id,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price ?? 0),
  };
}

async function customerIdFor(storeId: string, telegramId: string): Promise<string | null> {
  const { data, error } = await insforge.database
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/** Заказы покупателя в одной витрине (изоляция по storeId) */
export async function fetchBuyerOrders(storeId: string, telegramId: string): Promise<Order[]> {
  const customerId = await customerIdFor(storeId, telegramId);
  if (!customerId) return [];
  const { data, error } = await insforge.database
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as OrderRow[]).map(mapOrder);
}

/** Все заказы витрины для продавца */
export async function fetchStoreOrders(storeId: string): Promise<Order[]> {
  const { data, error } = await insforge.database
    .from('orders')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as OrderRow[]).map(mapOrder);
}

export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await insforge.database
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);
  if (error) throw error;
  return ((data ?? []) as OrderItemRow[]).map(mapOrderItem);
}

/**
 * Смена статуса продавцом. Уведомление покупателю отправляется отдельно
 * через telegram-notify (bot: buyer) — см. docs/API.md.
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const { data, error } = await insforge.database
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select();
  if (error) throw error;
  const row = (data ?? [])[0] as OrderRow | undefined;
  if (!row) throw new Error('Order update returned no data');
  return mapOrder(row);
}

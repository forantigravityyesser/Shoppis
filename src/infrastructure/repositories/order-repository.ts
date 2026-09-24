import { insforge } from '../insforge/client';
import type {
  DeliveryOutcome,
  Order,
  OrderActorType,
  OrderItem,
  OrderStatus,
  OrderStatusHistory,
  RefusalReasonCode,
} from '../../domain/models/order';

interface OrderRow {
  id: string;
  public_order_number: string;
  store_id: string;
  buyer_user_id: string;
  buyer_full_name_snapshot: string;
  buyer_phone_snapshot: string;
  buyer_address_snapshot: string;
  buyer_telegram_username_snapshot: string | null;
  status: OrderStatus;
  delivery_outcome: DeliveryOutcome | null;
  refusal_reason_code: RefusalReasonCode | null;
  currency_code: string;
  subtotal_minor: number;
  total_minor: number;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
  refused_at: string | null;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_title_snapshot: string;
  product_description_snapshot: string | null;
  product_image_snapshot: string | null;
  linking_attributes_snapshot: unknown;
  variant_name_snapshot: string | null;
  variant_value_snapshot: string | null;
  quantity: number;
  original_unit_price_minor: number;
  discount_percent: number;
  unit_price_minor: number;
  line_total_minor: number;
  currency_code: string;
}

interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_type: OrderActorType;
  actor_user_id: string | null;
  reason_code: string | null;
  created_at: string;
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    publicOrderNumber: row.public_order_number,
    storeId: row.store_id,
    buyerUserId: row.buyer_user_id,
    buyerFullNameSnapshot: row.buyer_full_name_snapshot ?? '',
    buyerPhoneSnapshot: row.buyer_phone_snapshot ?? '',
    buyerAddressSnapshot: row.buyer_address_snapshot ?? '',
    buyerTelegramUsernameSnapshot: row.buyer_telegram_username_snapshot ?? null,
    status: row.status,
    deliveryOutcome: row.delivery_outcome ?? null,
    refusalReasonCode: row.refusal_reason_code ?? null,
    currencyCode: row.currency_code ?? '',
    subtotalMinor: Number(row.subtotal_minor ?? 0),
    totalMinor: Number(row.total_minor ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at ?? null,
    completedAt: row.completed_at ?? null,
    refusedAt: row.refused_at ?? null,
  };
}

function parseLinking(raw: unknown): Array<{ name: string; value: string }> {
  if (Array.isArray(raw)) return raw as Array<{ name: string; value: string }>;
  return [];
}

function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id ?? null,
    variantId: row.variant_id ?? null,
    productTitleSnapshot: row.product_title_snapshot ?? '',
    productDescriptionSnapshot: row.product_description_snapshot ?? null,
    productImageSnapshot: row.product_image_snapshot ?? null,
    linkingAttributesSnapshot: parseLinking(row.linking_attributes_snapshot),
    variantNameSnapshot: row.variant_name_snapshot ?? null,
    variantValueSnapshot: row.variant_value_snapshot ?? null,
    quantity: row.quantity,
    originalUnitPriceMinor: Number(row.original_unit_price_minor ?? 0),
    discountPercent: row.discount_percent ?? 0,
    unitPriceMinor: Number(row.unit_price_minor ?? 0),
    lineTotalMinor: Number(row.line_total_minor ?? 0),
    currencyCode: row.currency_code ?? '',
  };
}

function mapHistory(row: OrderStatusHistoryRow): OrderStatusHistory {
  return {
    id: row.id,
    orderId: row.order_id,
    fromStatus: row.from_status ?? null,
    toStatus: row.to_status,
    actorType: row.actor_type,
    actorUserId: row.actor_user_id ?? null,
    reasonCode: row.reason_code ?? null,
    createdAt: row.created_at,
  };
}

/** Заказы покупателя в витрине. */
export async function fetchBuyerOrders(storeId: string, buyerUserId: string): Promise<Order[]> {
  const { data, error } = await insforge.database
    .from('orders')
    .select('*')
    .eq('store_id', storeId)
    .eq('buyer_user_id', buyerUserId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as OrderRow[]).map(mapOrder);
}

/** Все заказы витрины (панель продавца). */
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

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  outcome?: {
    deliveryOutcome?: DeliveryOutcome | null;
    refusalReasonCode?: RefusalReasonCode | null;
  },
): Promise<Order> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: now };
  if (status === 'CANCELLED') patch.cancelled_at = now;
  if (status === 'REFUSED') patch.refused_at = now;
  if (outcome?.deliveryOutcome !== undefined) {
    patch.delivery_outcome = outcome.deliveryOutcome;
    if (outcome.deliveryOutcome === 'RECEIVED') patch.completed_at = now;
  }
  if (outcome?.refusalReasonCode !== undefined) patch.refusal_reason_code = outcome.refusalReasonCode;

  const { data, error } = await insforge.database.from('orders').update(patch).eq('id', orderId).select();
  if (error) throw error;
  const row = (data ?? [])[0] as OrderRow | undefined;
  if (!row) throw new Error('Order update returned no data');
  return mapOrder(row);
}

export async function fetchOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
  const { data, error } = await insforge.database
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as OrderStatusHistoryRow[]).map(mapHistory);
}

export async function appendOrderStatusHistory(input: {
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: OrderActorType;
  actorUserId?: string | null;
  reasonCode?: string | null;
}): Promise<void> {
  const { error } = await insforge.database.from('order_status_history').insert({
    order_id: input.orderId,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    actor_type: input.actorType,
    actor_user_id: input.actorUserId ?? null,
    reason_code: input.reasonCode ?? null,
  });
  if (error) throw error;
}

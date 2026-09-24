import { invokeFunction } from '../insforge/functions-gateway';
import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../../domain/models/order';

export type OrderActor = 'buyer' | 'seller';

interface OrderActionResponse {
  success?: boolean;
  result?: unknown;
  error?: string;
}

async function callOrderAction(sessionToken: string, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await invokeFunction<OrderActionResponse>('order-actions', {
    body,
    token: sessionToken,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Order action failed');
  return data.result;
}

export function cancelOrder(
  sessionToken: string,
  orderId: string,
  actor: OrderActor,
  reason?: string,
): Promise<unknown> {
  return callOrderAction(sessionToken, { action: 'cancel', orderId, actorType: actor, reason });
}

export function transitionOrder(
  sessionToken: string,
  orderId: string,
  toStatus: OrderStatus,
  reason?: string,
): Promise<unknown> {
  return callOrderAction(sessionToken, { action: 'transition', orderId, toStatus, reason });
}

export function recordDeliveryOutcome(
  sessionToken: string,
  orderId: string,
  outcome: DeliveryOutcome,
  reason?: RefusalReasonCode,
): Promise<unknown> {
  return callOrderAction(sessionToken, { action: 'delivery-outcome', orderId, outcome, reason });
}

export function reconcileInventory(
  sessionToken: string,
  variantId: string,
  quantity: number,
  reason?: string,
): Promise<unknown> {
  return callOrderAction(sessionToken, { action: 'reconcile', variantId, quantity, reason });
}

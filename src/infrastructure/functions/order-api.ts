import { insforge } from '../insforge/client';
import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../../domain/models/order';

type InvokeOptions = { body?: unknown; headers?: Record<string, string> };

export type OrderActor = 'buyer' | 'seller';

async function callOrderAction(sessionToken: string, body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await (insforge.functions.invoke as unknown as (
    name: string,
    options?: InvokeOptions,
  ) => Promise<{ data: unknown; error: unknown }>)('order-actions', {
    body,
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (error) throw error;
  const res = data as { success?: boolean; result?: unknown; error?: string } | null;
  if (!res?.success) throw new Error(res?.error ?? 'Order action failed');
  return res.result;
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

import { invokeFunction } from '../insforge/functions-gateway';
import type { OrderScope, OrderStatusFilter } from '../../application/read-models/order';

interface OrderQueryResponse {
  success?: boolean;
  result?: unknown;
  error?: string;
}

export interface OrderListRequest {
  scope: OrderScope;
  storeRef: string;
  statusFilter?: OrderStatusFilter;
  cursor?: string | null;
  limit?: number;
}

export interface OrderDetailsRequest {
  scope: OrderScope;
  orderId: string;
}

async function callOrderQuery(
  sessionToken: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await invokeFunction<OrderQueryResponse>('order-queries', {
    body,
    token: sessionToken,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Order query failed');
  return data.result ?? null;
}

/** Raw list projection (JSON) from the `order-queries` edge — mapped by the repository. */
export function requestOrderList(
  sessionToken: string,
  request: OrderListRequest,
): Promise<unknown> {
  return callOrderQuery(sessionToken, {
    action: 'list',
    scope: request.scope,
    storeRef: request.storeRef,
    statusFilter: request.statusFilter ?? 'all',
    cursor: request.cursor ?? null,
    limit: request.limit ?? 20,
  });
}

/** Raw detail projection (JSON) or `null` from the `order-queries` edge. */
export function requestOrderDetails(
  sessionToken: string,
  request: OrderDetailsRequest,
): Promise<unknown> {
  return callOrderQuery(sessionToken, {
    action: 'detail',
    scope: request.scope,
    orderId: request.orderId,
  });
}

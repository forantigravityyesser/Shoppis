import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../../domain/models/order';
import type { Store } from '../../domain/models/store';
import type { AuthSession } from '../contracts/auth';
import type { CheckoutPayload, CheckoutResult } from '../contracts/checkout';
import type { CreateShopPayload } from '../contracts/store';

/** telegram-auth: валидация initData → сессия. */
export interface AuthApi {
  authenticateTelegram(initData: string): Promise<AuthSession>;
}

/** shop-create: создание витрины по валидной сессии. */
export interface ShopApi {
  createShopViaApi(token: string, payload: CreateShopPayload): Promise<Store>;
}

/** process-checkout: атомарное оформление заказа. */
export interface CheckoutApi {
  invokeCheckout(payload: CheckoutPayload): Promise<CheckoutResult>;
}

/** order-actions: жизненный цикл заказа и инвентаря. */
export interface OrderApi {
  cancelOrder(
    token: string,
    orderId: string,
    actor: 'buyer' | 'seller',
    reason?: string,
  ): Promise<unknown>;
  transitionOrder(
    token: string,
    orderId: string,
    toStatus: OrderStatus,
    reason?: string,
  ): Promise<unknown>;
  recordDeliveryOutcome(
    token: string,
    orderId: string,
    outcome: DeliveryOutcome,
    reason?: RefusalReasonCode,
  ): Promise<unknown>;
  reconcileInventory(
    token: string,
    variantId: string,
    quantity: number,
    reason?: string,
  ): Promise<unknown>;
}

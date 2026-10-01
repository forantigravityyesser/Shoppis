import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../../domain/models/order';
import type { Store, StoreStatus } from '../../domain/models/store';
import type { AuthSession } from '../contracts/auth';
import type { CheckoutPayload, CheckoutResult } from '../contracts/checkout';
import type { CreateShopPayload, StoreProfilePatch } from '../contracts/store';

/** telegram-auth: валидация initData → сессия. */
export interface AuthApi {
  authenticateTelegram(initData: string): Promise<AuthSession>;
}

/** shop-create: создание витрины по валидной сессии. */
export interface ShopApi {
  createShopViaApi(token: string, payload: CreateShopPayload): Promise<Store>;
}

/**
 * store-actions: мутации настроек магазина по валидной сессии.
 * `token === null` — только DEV-путь (DEV_AUTH_MODE).
 */
export interface StoreSettingsApi {
  updateProfile(token: string | null, storeId: string, patch: StoreProfilePatch): Promise<Store>;
  updateStatus(token: string | null, storeId: string, status: StoreStatus): Promise<Store>;
}

/** process-checkout: атомарное оформление заказа. */
export interface CheckoutApi {
  invokeCheckout(payload: CheckoutPayload): Promise<CheckoutResult>;
}

/** notifications-actions: opt-in Telegram-уведомлений покупателя. */
export interface NotificationApi {
  enableTelegramNotifications(token: string): Promise<void>;
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

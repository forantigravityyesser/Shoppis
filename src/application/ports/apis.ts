import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../../domain/models/order';
import type { Store, StoreStatus } from '../../domain/models/store';
import type { AuthSession } from '../contracts/auth';
import type { CheckoutPayload, CheckoutResult } from '../contracts/checkout';
import type { CreateShopPayload, StoreProfilePatch, TutorialStatePatch } from '../contracts/store';

/** telegram-auth: валидация initData → сессия. */
export interface AuthApi {
  authenticateTelegram(initData: string): Promise<AuthSession>;
}

/** shop-create: создание витрины по валидной сессии. */
export interface ShopApi {
  createShopViaApi(token: string, payload: CreateShopPayload): Promise<Store>;
}

/**
 * store-actions: чтение/мутации настроек магазина по валидной сессии.
 * `token === null` — только DEV-путь (DEV_AUTH_MODE).
 */
export interface StoreSettingsApi {
  /**
   * Owner-scoped чтение магазина. `storeRef` — канон `public_id` (legacy внутренний
   * id резолвится сервером). `null` — чужой/несуществующий магазин, не ошибка сети.
   */
  readStore(token: string | null, storeRef: string): Promise<Store | null>;
  updateProfile(token: string | null, storeId: string, patch: StoreProfilePatch): Promise<Store>;
  updateStatus(token: string | null, storeId: string, status: StoreStatus): Promise<Store>;
  updateTutorialState(
    token: string | null,
    storeId: string,
    patch: TutorialStatePatch,
  ): Promise<Store>;
}

/** process-checkout: атомарное оформление заказа. */
export interface CheckoutApi {
  invokeCheckout(payload: CheckoutPayload): Promise<CheckoutResult>;
}

/** notifications-actions: opt-in Telegram-уведомлений покупателя (+ досыл заказа). */
export interface NotificationApi {
  enableTelegramNotifications(token: string, orderId?: string): Promise<void>;
}

/** Посещённая витрина покупателя (buyer-stores). */
export interface VisitedStore {
  publicId: string;
  name: string;
  lastVisitedAt: string;
}

/** store-visit / buyer-stores: визиты покупателя (список магазинов, счётчики). */
export interface StoreVisitApi {
  recordStoreVisit(token: string, storeRef: string): Promise<void>;
  /** Посещённые витрины, свежие первыми: fallback входа без deep-link (главный Mini App). */
  loadVisitedStores(token: string): Promise<VisitedStore[]>;
}

/** share-actions: подготовка карточки товара для нативного шаринга (id для shareMessage). */
export interface ShareApi {
  /** Возвращает `PreparedInlineMessage.id`; `photoUrl` — публичный JPEG из бакета. */
  prepareShare(
    token: string,
    publicId: string,
    productId: string,
    photoUrl: string,
  ): Promise<string>;
}

/** review-actions: запись отзывов/ответов по валидной сессии (actor из сессии). */
export interface ReviewApi {
  createReview(token: string, productId: string, rating: number, text: string): Promise<void>;
  hideReview(token: string, reviewId: string): Promise<void>;
  replyToReview(token: string, reviewId: string, text: string): Promise<void>;
  /** Seller-чтение отзывов (в т.ч. ARCHIVED): owner-check на сервере, actor из сессии. */
  loadSellerReviews(token: string, productId: string): Promise<unknown>;
}

/** question-actions: запись вопросов/ответов по валидной сессии (actor из сессии). */
export interface QuestionApi {
  createQuestion(token: string, productId: string, text: string): Promise<void>;
  hideQuestion(token: string, questionId: string): Promise<void>;
  answerQuestion(token: string, questionId: string, text: string): Promise<void>;
  /** Seller-чтение вопросов (в т.ч. ARCHIVED): owner-check на сервере, actor из сессии. */
  loadSellerQuestions(token: string, productId: string): Promise<unknown>;
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
    orderId?: string,
  ): Promise<unknown>;
}

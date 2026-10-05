import type {
  AuthApi,
  CheckoutApi,
  NotificationApi,
  OrderApi,
  QuestionApi,
  ReviewApi,
  ShopApi,
  StoreSettingsApi,
} from '../ports/apis';
import type { CategoryRepository } from '../ports/category-repository';
import type { I18nPort } from '../ports/i18n';
import type { IdentityProvider } from '../ports/identity';
import type { OrderRepository } from '../ports/order-repository';
import type { ProductRepository } from '../ports/product-repository';
import type { ImageUploadPort, StoragePort } from '../ports/storage';
import type { StoreRepository } from '../ports/store-repository';
import type { StorefrontProductRepository } from '../ports/storefront-product-repository';
import type { StorefrontCatalogRepository } from '../ports/storefront-catalog-repository';
import type { StorefrontRepository } from '../ports/storefront-repository';
import type { HapticsPort, TelegramPort } from '../ports/telegram';

/**
 * Единая точка сборки зависимостей приложения (ручной DI).
 *
 * application зависит только от этого контейнера и портов; конкретные реализации
 * (InsForge/Telegram/Storage) собираются в composition root и подставляются сюда.
 */
export interface AppContainer {
  productRepository: ProductRepository;
  categoryRepository: CategoryRepository;
  storeRepository: StoreRepository;
  storefrontRepository: StorefrontRepository;
  storefrontProductRepository: StorefrontProductRepository;
  storefrontCatalogRepository: StorefrontCatalogRepository;
  orderRepository: OrderRepository;
  storage: StoragePort;
  imageUpload: ImageUploadPort;
  authApi: AuthApi;
  shopApi: ShopApi;
  storeSettingsApi: StoreSettingsApi;
  checkoutApi: CheckoutApi;
  orderApi: OrderApi;
  notificationApi: NotificationApi;
  reviewApi: ReviewApi;
  questionApi: QuestionApi;
  identity: IdentityProvider;
  telegram: TelegramPort;
  haptics: HapticsPort;
  i18n: I18nPort;
}

let container: AppContainer | null = null;

/** Настраивается один раз в composition root до первого обращения к `deps()`. */
export function configureDependencies(next: AppContainer): void {
  container = next;
}

export function deps(): AppContainer {
  if (!container) {
    throw new Error(
      'App dependencies are not configured. Call configureDependencies() in the composition root.',
    );
  }
  return container;
}

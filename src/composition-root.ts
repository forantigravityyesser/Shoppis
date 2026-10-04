// composition-root.ts — сборка конкретных реализаций и регистрация их в контейнере.
//
// Это единственное место верхнего уровня, которое знает обо всех технологиях
// (InsForge, Telegram, Storage). application работает только с портами.
//
// Импортируется ПЕРВЫМ в main.tsx, до создания Zustand-store: слайс settings
// читает язык через `deps()` уже при инициализации.

import { configureDependencies, type AppContainer } from './application/composition/container';
import * as productRepository from './infrastructure/repositories/product-repository';
import * as categoryRepository from './infrastructure/repositories/category-repository';
import * as orderRepository from './infrastructure/repositories/order-repository';
import * as storefrontRepository from './infrastructure/repositories/storefront-repository';
import * as storefrontProductRepository from './infrastructure/repositories/storefront-product-repository';
import {
  checkOwnershipByUser,
  createStore,
  fetchStore,
  fetchStoresByOwnerUser,
} from './infrastructure/repositories/store-repository';
import {
  checkOwnershipByTelegram,
  fetchStoresByOwnerTelegram,
} from './infrastructure/repositories/store-repository.dev';
import * as storage from './infrastructure/storage/file-storage';
import * as imageUpload from './infrastructure/storage/image-upload';
import * as authApi from './infrastructure/functions/auth-api';
import * as shopApi from './infrastructure/functions/shop-api';
import * as storeSettingsApi from './infrastructure/functions/store-settings-api';
import * as checkoutApi from './infrastructure/functions/checkout-api';
import * as orderApi from './infrastructure/functions/order-api';
import * as notificationApi from './infrastructure/functions/notification-api';
import * as reviewApi from './infrastructure/functions/review-api';
import * as questionApi from './infrastructure/functions/question-api';
import * as identity from './infrastructure/auth/identity-provider';
import * as telegramApp from './infrastructure/telegram/telegram-app';
import * as telegramShare from './infrastructure/telegram/telegram-share';
import * as haptics from './infrastructure/telegram/telegram-haptic';
import * as i18n from './infrastructure/i18n/i18n';

const container: AppContainer = {
  productRepository,
  categoryRepository,
  orderRepository,
  storefrontRepository,
  storefrontProductRepository,
  storage,
  imageUpload,
  authApi,
  shopApi,
  storeSettingsApi,
  checkoutApi,
  orderApi,
  notificationApi,
  reviewApi,
  questionApi,
  identity,
  haptics,
  i18n,
  storeRepository: {
    fetchStore,
    fetchStoresByOwnerUser,
    createStore,
    checkOwnershipByUser,
    fetchStoresByOwnerTelegram,
    checkOwnershipByTelegram,
  },
  telegram: {
    getStartParam: telegramApp.getStartParam,
    getBuyerBotUsername: telegramApp.getBuyerBotUsername,
    getBuyerAppShortname: telegramApp.getBuyerAppShortname,
    openTelegramLink: telegramApp.openTelegramLink,
    requestMessagesAccess: telegramShare.requestMessagesAccess,
  },
};

configureDependencies(container);

import type { ParseKeys } from 'i18next';
import type { TutorialStepKey } from '../../../domain/models/tutorial';

/**
 * Представление шага обучения для оверлея (docs/26 §4.2, TUT-05/TUT-07). Чистый
 * резолвер: по ключу шага и текущему маршруту возвращает подшаги с якорями
 * (`data-tour`) и i18n-ключами. Действия (навигация/переход) применяет оверлей.
 *
 * Подшаги продукт-креате ведут по РЕАЛЬНЫМ полям формы (название → размерность →
 * значение → количество → цена → публикация): без них товар не попадёт на витрину.
 */

/** Типизированный ключ перевода (проверяется компилятором, см. i18next.d.ts). */
export type TutorialTextKey = ParseKeys;

export interface TutorialPartView {
  /** CSS-селектор подсвечиваемого элемента или null (карточка без spotlight). */
  target: string | null;
  titleKey: TutorialTextKey;
  textKey: TutorialTextKey;
  /** Ключ подписи основной кнопки; null — подшаг завершается действием пользователя. */
  primaryKey: TutorialTextKey | null;
  /** Необязательный подшаг: показываем «Пропустить шаг» (фото, описание). */
  skippable?: boolean;
  /** Действие по клику на саму цель (копирование ссылки → финал). */
  onClickAction?: 'to-finish';
}

export interface TutorialStepView {
  parts: TutorialPartView[];
  /** «Пропустить шаг» только там, где не ломает сценарий (orientation). */
  skippable: boolean;
}

/** Якорь вкладки «Инвентарь» (существующий `data-nav-id` в BottomNavBar). */
export const NAV_INVENTORY_SELECTOR = '[data-nav-id="/seller/inventory"]';
/** Якорь вкладки «Настройки». */
export const NAV_SETTINGS_SELECTOR = '[data-nav-id="/seller/settings"]';
/** Якорь кнопки «+ Добавить» в шапке секции инвентаря. */
export const INVENTORY_ADD_SELECTOR = '[data-tour="inventory-add"]';
/** Якорь строки «Поделиться магазином» в настройках. */
export const SETTINGS_SHARE_SELECTOR = '[data-tour="settings-share"]';
/** Якорь кнопки «Копировать» на экране шаринга. */
export const SHARE_COPY_SELECTOR = '[data-tour="share-copy"]';
export const INVENTORY_ROUTE = '/seller/inventory';
export const PRODUCT_CREATE_ROUTE = '/seller/inventory/product/new';
export const SETTINGS_ROUTE = '/seller/settings';
export const SETTINGS_SHARE_ROUTE = '/seller/settings/share';

export function isInventoryRoute(pathname: string): boolean {
  return pathname === INVENTORY_ROUTE;
}

export function isProductCreateRoute(pathname: string): boolean {
  return pathname === PRODUCT_CREATE_ROUTE || pathname.startsWith(`${PRODUCT_CREATE_ROUTE}/`);
}

export function isSettingsRoute(pathname: string): boolean {
  return pathname === SETTINGS_ROUTE;
}

export function isSettingsShareRoute(pathname: string): boolean {
  return pathname === SETTINGS_SHARE_ROUTE || pathname.startsWith(`${SETTINGS_SHARE_ROUTE}/`);
}

/** Подшаги ведения по реальной форме создания товара. Фото и описание — необязательны. */
const PRODUCT_FORM_PARTS: TutorialPartView[] = [
  {
    target: '[data-tour="product-photo"]',
    titleKey: 'seller.tutorial.steps.productCreate.photoTitle',
    textKey: 'seller.tutorial.steps.productCreate.photoText',
    primaryKey: 'seller.tutorial.next',
    skippable: true,
  },
  {
    target: '[data-tour="product-title"]',
    titleKey: 'seller.tutorial.steps.productCreate.titleTitle',
    textKey: 'seller.tutorial.steps.productCreate.titleText',
    primaryKey: 'seller.tutorial.next',
  },
  {
    target: '[data-tour="product-description"]',
    titleKey: 'seller.tutorial.steps.productCreate.descriptionTitle',
    textKey: 'seller.tutorial.steps.productCreate.descriptionText',
    primaryKey: 'seller.tutorial.next',
    skippable: true,
  },
  {
    target: '[data-tour="product-dimension"]',
    titleKey: 'seller.tutorial.steps.productCreate.dimensionTitle',
    textKey: 'seller.tutorial.steps.productCreate.dimensionText',
    primaryKey: 'seller.tutorial.next',
  },
  {
    target: '[data-tour="product-value"]',
    titleKey: 'seller.tutorial.steps.productCreate.valueTitle',
    textKey: 'seller.tutorial.steps.productCreate.valueText',
    primaryKey: 'seller.tutorial.next',
  },
  {
    target: '[data-tour="product-quantity"]',
    titleKey: 'seller.tutorial.steps.productCreate.quantityTitle',
    textKey: 'seller.tutorial.steps.productCreate.quantityText',
    primaryKey: 'seller.tutorial.next',
  },
  {
    target: '[data-tour="product-price"]',
    titleKey: 'seller.tutorial.steps.productCreate.priceTitle',
    textKey: 'seller.tutorial.steps.productCreate.priceText',
    primaryKey: 'seller.tutorial.next',
  },
  {
    target: '[data-tour="product-publish"]',
    titleKey: 'seller.tutorial.steps.productCreate.publishTitle',
    textKey: 'seller.tutorial.steps.productCreate.publishText',
    primaryKey: null,
  },
];

export function resolveTutorialStepView(
  step: TutorialStepKey | null,
  pathname: string,
): TutorialStepView | null {
  switch (step) {
    case 'orientation':
      // Ведём к реальной вкладке «Инвентарь»: пользователь тапает её, и шаг
      // переключается автоматически на следующем экране (см. оверлей).
      return {
        skippable: true,
        parts: [
          {
            target: NAV_INVENTORY_SELECTOR,
            titleKey: 'seller.tutorial.steps.orientation.title',
            textKey: 'seller.tutorial.steps.orientation.text',
            primaryKey: null,
          },
        ],
      };

    case 'product-create':
      // Экран создания — ведём по обязательным полям формы.
      if (isProductCreateRoute(pathname)) {
        return { skippable: false, parts: PRODUCT_FORM_PARTS };
      }
      // Инвентарь — подсвечиваем реальную кнопку «+» (её и надо нажать).
      if (isInventoryRoute(pathname)) {
        return {
          skippable: false,
          parts: [
            {
              target: INVENTORY_ADD_SELECTOR,
              titleKey: 'seller.tutorial.steps.productCreate.addTitle',
              textKey: 'seller.tutorial.steps.productCreate.addText',
              primaryKey: null,
            },
          ],
        };
      }
      // На других экранах — ведём в «Инвентарь».
      return {
        skippable: false,
        parts: [
          {
            target: NAV_INVENTORY_SELECTOR,
            titleKey: 'seller.tutorial.steps.productCreate.title',
            textKey: 'seller.tutorial.steps.productCreate.text',
            primaryKey: null,
          },
        ],
      };

    case 'product-buyer-view':
      // Шаг закрывается сам при возврате из предпросмотра (см. оверлей) — без «Далее».
      return {
        skippable: false,
        parts: [
          {
            target: '[data-tour="product-preview"]',
            titleKey: 'seller.tutorial.steps.productBuyerView.title',
            textKey: 'seller.tutorial.steps.productBuyerView.text',
            primaryKey: null,
          },
        ],
      };

    case 'storefront':
      // Экран шаринга — копируем ссылку; по клику уходим на главную и завершаем.
      if (isSettingsShareRoute(pathname)) {
        return {
          skippable: false,
          parts: [
            {
              target: SHARE_COPY_SELECTOR,
              titleKey: 'seller.tutorial.steps.storefront.copyTitle',
              textKey: 'seller.tutorial.steps.storefront.copyText',
              primaryKey: null,
              onClickAction: 'to-finish',
            },
          ],
        };
      }
      // Экран настроек — подсвечиваем строка «Поделиться магазином».
      if (isSettingsRoute(pathname)) {
        return {
          skippable: false,
          parts: [
            {
              target: SETTINGS_SHARE_SELECTOR,
              titleKey: 'seller.tutorial.steps.storefront.shareTitle',
              textKey: 'seller.tutorial.steps.storefront.shareText',
              primaryKey: null,
            },
          ],
        };
      }
      // На других экранах — ведём к вкладке «Настройки».
      return {
        skippable: false,
        parts: [
          {
            target: NAV_SETTINGS_SELECTOR,
            titleKey: 'seller.tutorial.steps.storefront.toSettingsTitle',
            textKey: 'seller.tutorial.steps.storefront.toSettingsText',
            primaryKey: null,
          },
        ],
      };

    case 'finish':
      return {
        skippable: false,
        parts: [
          {
            target: null,
            titleKey: 'seller.tutorial.steps.finish.title',
            textKey: 'seller.tutorial.steps.finish.text',
            primaryKey: 'seller.tutorial.done',
          },
        ],
      };

    default:
      return null;
  }
}

import { describe, expect, it } from 'vitest';
import {
  INVENTORY_ADD_SELECTOR,
  NAV_INVENTORY_SELECTOR,
  NAV_SETTINGS_SELECTOR,
  PRODUCT_CREATE_ROUTE,
  SETTINGS_SHARE_SELECTOR,
  SHARE_COPY_SELECTOR,
  isInventoryRoute,
  isProductCreateRoute,
  resolveTutorialStepView,
} from './tutorial-steps';

describe('route helpers', () => {
  it('isProductCreateRoute', () => {
    expect(isProductCreateRoute(PRODUCT_CREATE_ROUTE)).toBe(true);
    expect(isProductCreateRoute('/seller/inventory/product/p1')).toBe(false);
  });
  it('isInventoryRoute', () => {
    expect(isInventoryRoute('/seller/inventory')).toBe(true);
    expect(isInventoryRoute('/seller/inventory/product/new')).toBe(false);
  });
});

describe('resolveTutorialStepView', () => {
  it('orientation: spotlight на «Инвентарь», без primary (тап по вкладке), можно пропустить', () => {
    const view = resolveTutorialStepView('orientation', '/seller/dashboard');
    expect(view?.skippable).toBe(true);
    expect(view?.parts).toHaveLength(1);
    expect(view?.parts[0].target).toBe(NAV_INVENTORY_SELECTOR);
    expect(view?.parts[0].primaryKey).toBeNull();
  });

  it('product-create вне формы: ведём в «Инвентарь», без primary', () => {
    const view = resolveTutorialStepView('product-create', '/seller/dashboard');
    expect(view?.parts[0].target).toBe(NAV_INVENTORY_SELECTOR);
    expect(view?.parts[0].primaryKey).toBeNull();
  });

  it('product-create в инвентаре: spotlight на реальной кнопке «+»', () => {
    const view = resolveTutorialStepView('product-create', '/seller/inventory');
    expect(view?.parts[0].target).toBe(INVENTORY_ADD_SELECTOR);
    expect(view?.parts[0].primaryKey).toBeNull();
  });

  it('product-create в форме: подшаги по обязательным полям формы', () => {
    const view = resolveTutorialStepView('product-create', PRODUCT_CREATE_ROUTE);
    expect(view?.parts.map((p) => p.target)).toEqual([
      '[data-tour="product-photo"]',
      '[data-tour="product-title"]',
      '[data-tour="product-description"]',
      '[data-tour="product-dimension"]',
      '[data-tour="product-value"]',
      '[data-tour="product-quantity"]',
      '[data-tour="product-price"]',
      '[data-tour="product-publish"]',
    ]);
    // Фото и описание — необязательные (со «Пропустить шаг»).
    expect(view?.parts[0].skippable).toBe(true);
    expect(view?.parts[2].skippable).toBe(true);
    expect(view?.parts[1].skippable).toBeUndefined();
    expect(view?.parts[7].primaryKey).toBeNull();
  });

  it('product-buyer-view: spotlight на кнопке предпросмотра, без «Далее» (закрывается по возврату)', () => {
    const view = resolveTutorialStepView('product-buyer-view', '/seller/inventory/product/p1');
    expect(view?.parts[0].target).toBe('[data-tour="product-preview"]');
    expect(view?.parts[0].primaryKey).toBeNull();
  });

  it('storefront на других экранах: spotlight на вкладке «Настройки»', () => {
    const view = resolveTutorialStepView('storefront', '/seller/inventory/product/p1');
    expect(view?.parts[0].target).toBe(NAV_SETTINGS_SELECTOR);
    expect(view?.parts[0].primaryKey).toBeNull();
  });

  it('storefront в настройках: spotlight на строке «Поделиться магазином»', () => {
    const view = resolveTutorialStepView('storefront', '/seller/settings');
    expect(view?.parts[0].target).toBe(SETTINGS_SHARE_SELECTOR);
  });

  it('storefront на экране шаринга: spotlight на «Копировать» + действие по клику', () => {
    const view = resolveTutorialStepView('storefront', '/seller/settings/share');
    expect(view?.parts[0].target).toBe(SHARE_COPY_SELECTOR);
    expect(view?.parts[0].onClickAction).toBe('to-finish');
  });

  it('finish: карточка-поздравление без spotlight', () => {
    const view = resolveTutorialStepView('finish', '/seller/dashboard');
    expect(view?.parts[0].target).toBeNull();
    expect(view?.parts[0].primaryKey).toBe('seller.tutorial.done');
    expect(view?.parts[0].titleKey).toBe('seller.tutorial.steps.finish.title');
  });

  it('неизвестные шаги → null', () => {
    expect(resolveTutorialStepView(null, '/seller/dashboard')).toBeNull();
  });
});

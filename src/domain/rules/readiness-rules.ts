import type { ShopReadiness, StoreReadinessInput } from '../models/tutorial';
import { normalizeTelegramUsername } from './store-contact-rules';

/**
 * Чек-лист подготовки магазина — чистая функция над уже загруженными данными
 * (docs/26 §3.4). Ничего не пишет в БД: статусы вычисляются из доменных данных
 * (`currentStore` + серверные counts), дублирующих флагов нет (§3.1, §3.10).
 *
 * Прогресс считается по всем видимым шагам чек-листа (5): название, оформление,
 * товар, категория, контакт. Так число «N из M» совпадает с числом пунктов на экране.
 * «Магазин подготовлен» = выполнены все шаги. Правка продуктовой модели по итогам
 * UI-ревью (docs/26 §8.2 — переопределено).
 */

/** Число шагов чек-листа: название + оформление + товар + категория + контакт. */
export const READINESS_TOTAL = 5;

function isNonEmpty(value: string): boolean {
  return String(value ?? '').trim().length > 0;
}

/** Оформление — баннер и/или описание (§8.1). */
export function hasStoreAppearance(bannerUrl: string, description: string): boolean {
  return isNonEmpty(bannerUrl) || isNonEmpty(description);
}

/** Контакт засчитывается только при валидном username (`store-contact-rules.ts:9`). */
export function hasValidSupportHandle(handle: string): boolean {
  return normalizeTelegramUsername(handle).valid;
}

export function computeShopReadiness(input: StoreReadinessInput): ShopReadiness {
  // Название гарантировано при создании магазина (NOT NULL) — всегда выполнено.
  const storeName: ShopReadiness['storeName'] = 'completed';
  const storeAppearance: ShopReadiness['storeAppearance'] = hasStoreAppearance(
    input.bannerUrl,
    input.description,
  )
    ? 'completed'
    : 'incomplete';
  const availableProduct: ShopReadiness['availableProduct'] =
    input.buyerAvailableProducts >= 1 ? 'completed' : 'incomplete';
  const category: ShopReadiness['category'] =
    input.activeCategories >= 1 ? 'completed' : 'incomplete';
  const supportLinks: ShopReadiness['supportLinks'] = hasValidSupportHandle(input.supportHandle)
    ? 'completed'
    : 'incomplete';

  const completed = [storeName, storeAppearance, availableProduct, category, supportLinks].filter(
    (status) => status === 'completed',
  ).length;

  return {
    storeName,
    storeAppearance,
    availableProduct,
    category,
    supportLinks,
    preparationReady: completed === READINESS_TOTAL,
    progress: { completed, total: READINESS_TOTAL },
  };
}

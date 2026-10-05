import type { StorefrontProductCard } from '../read-models/storefront';
import type {
  StorefrontCatalogPriceBounds,
  StorefrontCatalogProductPage,
  StorefrontCatalogQuery,
} from '../read-models/storefront-catalog';

/**
 * Публичное чтение Каталога покупателя (docs/17 §2). Каждый вызов = один read-запрос
 * к бэкенду; фильтрация/поиск/пагинация выполняются на сервере. `null` — магазин не
 * найден. Цена карточек использует ту же price semantics, что Home
 * (`StorefrontProductCard.price`).
 */
export interface StorefrontCatalogRepository {
  /** Страница каталога (`storefront_catalog_products_read`). */
  loadCatalogProducts(query: StorefrontCatalogQuery): Promise<StorefrontCatalogProductPage | null>;
  /**
   * Товары избранного по явному списку id (`storefront_favorite_products_read`).
   * Та же проекция и price-semantics, что у каталога; порядок = порядок `ids`.
   * Архивные/удалённые/чужие id просто отсутствуют в ответе; пустой `ids` → `[]`.
   */
  loadProductsByIds(storePublicId: string, ids: string[]): Promise<StorefrontProductCard[]>;
  /**
   * Границы актуальных цен магазина для фильтра
   * (`storefront_catalog_price_bounds_read`). `null` — магазин не найден.
   */
  loadCatalogPriceBounds(storePublicId: string): Promise<StorefrontCatalogPriceBounds | null>;
}

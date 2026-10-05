import type { StorefrontProductCard } from './storefront';

/**
 * Application-контракт вкладки Каталог покупателя (docs/17 §2). Catalog полностью
 * server-driven: категория, поиск, цена и пагинация вычисляются на бэкенде
 * (`storefront_catalog_products_read`); клиент лишь формирует запрос и управляет
 * курсором. Своя модель товара не создаётся — переиспользуется
 * `StorefrontProductCard`, как на Home.
 */

/** Параметры одного запроса страницы каталога. */
export interface StorefrontCatalogQuery {
  publicId: string;
  /** Размер страницы (серверный `limit`, зажимается в [1, 24]). */
  limit: number;
  /** Выбранная категория; null/undefined — все категории. */
  categoryId?: string | null;
  /** Поиск по названию (регистронезависимая подстрока); пусто — без фильтра. */
  search?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  /** Keyset-курсор предыдущей страницы; null/undefined — первая страница. */
  cursor?: string | null;
}

/** Страница каталога — тот же состав карточек, что и поток Home. */
export interface StorefrontCatalogProductPage {
  products: StorefrontProductCard[];
  /** null — страниц больше нет. */
  nextCursor: string | null;
}

/**
 * Реальные границы актуальных цен магазина для слайдера фильтра (store-wide,
 * docs/17 §2.2). null — у магазина нет активных товаров.
 */
export interface StorefrontCatalogPriceBounds {
  minPrice: number | null;
  maxPrice: number | null;
}

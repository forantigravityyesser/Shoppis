import type { StorefrontHome, StorefrontHomeProductPage } from '../read-models/storefront';
import type { PublicStoreContext } from '../read-models/public-store';

/**
 * Публичное чтение витрины покупателя. Каждый вызов = один read-запрос к
 * бэкенду. `null` — витрина не найдена. docs/15 §4-6.
 */
export interface StorefrontRepository {
  /** Статичный контекст: store + активные категории (`storefront_home_context_read`). */
  loadStorefrontHome(storePublicId: string): Promise<StorefrontHome | null>;
  /**
   * Страница товарного потока (`storefront_home_products_read`). `cursor = null` —
   * первая страница; далее `nextCursor` предыдущей. `limit` — размер страницы.
   */
  loadStorefrontHomeProducts(
    storePublicId: string,
    cursor: string | null,
    limit: number,
  ): Promise<StorefrontHomeProductPage | null>;
  /**
   * Минимальный публичный контекст магазина (`storefront_public_context_read`).
   * `storeRef` — opaque `public_id`; внутренний id legacy-ссылки `store_<id>`
   * поддержан как временная совместимость внутри резолвера. `null` — не найден.
   */
  loadPublicStoreContext(storeRef: string): Promise<PublicStoreContext | null>;
}

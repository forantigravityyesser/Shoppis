import type { StorefrontHome } from '../read-models/storefront';

/**
 * Публичное чтение витрины покупателя. Один вызов = один read-запрос к бэкенду
 * (`storefront_home_read`, docs/13 §19-21). `null` — витрина не найдена.
 */
export interface StorefrontRepository {
  loadStorefrontHome(storePublicId: string): Promise<StorefrontHome | null>;
}

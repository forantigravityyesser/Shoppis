import type { StoreStatus } from '../../domain/models/store';

/**
 * Минимальный публичный контекст витрины для покупателя. Резолвится по opaque
 * `public_id` (или, как временная совместимость, по внутреннему id legacy-ссылки
 * `store_<id>`) до загрузки storefront-данных. docs/15 §4.
 *
 * Здесь только то, что разрешено покупателю: без `owner_user_id`,
 * `owner_telegram_id` и прочих private seller data. `logoUrl` — публичный
 * storefront-asset (используется на pause-экране), не Telegram-аватар продавца.
 */
export interface PublicStoreContext {
  id: string;
  publicId: string;
  name: string;
  status: StoreStatus;
  /** Публичный контакт продавца (для pause-экрана); null, если не задан. */
  supportHandle: string | null;
  /** Публичный логотип магазина; null, если не задан. */
  logoUrl: string | null;
}

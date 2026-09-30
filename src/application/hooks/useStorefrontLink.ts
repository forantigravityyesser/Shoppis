import { deps } from '../composition/container';
import { buildStorefrontLink } from '../../domain/rules/storefront-link';

/**
 * Публичная ссылка на витрину по opaque `public_id`. Bot username/app берутся
 * из конфига через порт — presentation не зависит от infrastructure. 12 §5.4.
 */
export function useStorefrontLink(publicId: string): string {
  const { telegram } = deps();
  return buildStorefrontLink({
    botUsername: telegram.getBuyerBotUsername(),
    appShortname: telegram.getBuyerAppShortname(),
    publicId,
  });
}

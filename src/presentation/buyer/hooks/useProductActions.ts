import i18n from 'i18next';
import { useStore } from '../../../application/store';
import { useStorefrontProductLink } from '../../../application/hooks/useStorefrontLink';
import { useOpenTelegramLink } from '../../../application/hooks/useOpenTelegramLink';
import { useHaptic } from '../../../application/hooks/useHaptic';
import { useFavorites } from '../../../application/hooks/useFavorites';
import { useCart } from '../../../application/hooks/useCart';
import { deps } from '../../../application/composition/container';
import type {
  StorefrontProductDetail,
  StorefrontProductVariant,
} from '../../../application/read-models/storefront-product';

export interface ProductActions {
  isFavorite: boolean;
  toggleFavorite: () => void;
  addToCart: () => void;
  share: () => void;
}

/**
 * Побочные действия карточки: избранное, добавление в корзину, share. Держит
 * UI-обвязку (haptic / toast / share-ссылка) вне `DetailsView`. Корзина ничего не
 * резервирует — финальная проверка цены/остатка на checkout. docs/18 PD-H-15;
 * docs/14 §10-11, §16.
 */
export function useProductActions(
  detail: StorefrontProductDetail | null,
  selectedVariant: StorefrontProductVariant | null,
): ProductActions {
  const productUrl = useStorefrontProductLink(
    detail?.store.publicId ?? '',
    detail?.product.id ?? '',
  );
  const openTelegramLink = useOpenTelegramLink();
  const { selectTick, notifySuccess } = useHaptic();
  const showToast = useStore((s) => s.showToast);
  const sessionToken = useStore((s) => s.sessionToken);
  const { isFavorite, toggleFavorite: toggleFavoriteRaw } = useFavorites();
  const { addToCart: addToCartRaw } = useCart();

  const productId = detail?.product.id ?? null;

  const toggleFavorite = () => {
    if (!productId) return;
    selectTick();
    toggleFavoriteRaw(productId);
  };

  const addToCart = () => {
    if (!detail || !selectedVariant?.available) return;
    addToCartRaw({
      productId: detail.product.id,
      productVariantId: selectedVariant.id,
      quantity: 1,
      price: selectedVariant.price,
    });
    notifySuccess();
    showToast({
      text: i18n.t('buyer.product.addedToCart'),
      imageUrl: detail.images[0]?.thumbUrl ?? detail.images[0]?.url ?? null,
      action: '/cart',
    });
  };

  /**
   * Поделиться товаром. Приоритет — красивая карточка (фото + текст + кнопка):
   * готовим JPEG, сервер собирает `savePreparedInlineMessage`, открываем нативный
   * диалог Telegram. На клиентах без Bot API 8.0 / при ошибке — fallback на
   * `t.me/share/url` (текст + ссылка на товар).
   */
  const share = () => {
    void (async () => {
      if (!detail) return;
      const publicId = detail.store.publicId;
      const id = detail.product.id;
      const imageUrl = detail.images[0]?.url ?? null;

      if (sessionToken && imageUrl) {
        try {
          const photoUrl = await deps().storage.ensureShareImage(id, imageUrl);
          if (photoUrl) {
            const preparedId = await deps().shareApi.prepareShare(
              sessionToken,
              publicId,
              id,
              photoUrl,
            );
            if (deps().telegram.sharePreparedMessage(preparedId)) return;
          }
        } catch {
          // Любая ошибка подготовки — уходим в обычный share ниже.
        }
      }

      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
        productUrl,
      )}&text=${encodeURIComponent(detail.product.title)}`;
      openTelegramLink(shareUrl);
    })();
  };

  return {
    isFavorite: productId ? isFavorite(productId) : false,
    toggleFavorite,
    addToCart,
    share,
  };
}

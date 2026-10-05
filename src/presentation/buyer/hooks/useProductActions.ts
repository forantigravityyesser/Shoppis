import { useStore } from '../../../application/store';
import { useStorefrontLink } from '../../../application/hooks/useStorefrontLink';
import { useOpenTelegramLink } from '../../../application/hooks/useOpenTelegramLink';
import { useHaptic } from '../../../application/hooks/useHaptic';
import { useFavorites } from '../../../application/hooks/useFavorites';
import { useCart } from '../../../application/hooks/useCart';
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
  const storefrontUrl = useStorefrontLink(detail?.store.publicId ?? '');
  const openTelegramLink = useOpenTelegramLink();
  const { selectTick, notifySuccess } = useHaptic();
  const showToast = useStore((s) => s.showToast);
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
      text: 'Добавлено в корзину',
      imageUrl: detail.images[0]?.thumbUrl ?? detail.images[0]?.url ?? null,
    });
  };

  const share = () => {
    if (!detail) return;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
      storefrontUrl,
    )}&text=${encodeURIComponent(detail.product.title)}`;
    openTelegramLink(shareUrl);
  };

  return {
    isFavorite: productId ? isFavorite(productId) : false,
    toggleFavorite,
    addToCart,
    share,
  };
}

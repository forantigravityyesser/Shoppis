import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../store';
import { markTutorialPreviewOpened } from './useSellerTutorial';

/**
 * Открыть покупательский предпросмотр карточки товара из seller-интерфейса.
 *
 * Временно переводит `context` в `buyer` и переходит на публичную карточку
 * `/product/:id`. Возврат («назад») обеспечивает `previewReturnPath` —
 * `DetailsView` вернёт в seller-карточку товара, а не на витрину.
 *
 * `returnPath` — seller-маршрут детали товара (`/seller/inventory/product/:id`).
 *
 * На шаге обучения `product-buyer-view` отмечает факт предпросмотра, чтобы по
 * возврату шаг закрылся сам (docs/26 §4.4, TUT-06).
 */
export function useProductPreview() {
  const navigate = useNavigate();

  const openProductPreview = useCallback(
    (productId: string, returnPath: string) => {
      const { currentStore, enterStorePreview } = useStore.getState();
      if (!currentStore?.publicId) return;
      if (
        currentStore.tutorialStatus === 'in_progress' &&
        currentStore.tutorialStep === 'product-buyer-view'
      ) {
        markTutorialPreviewOpened();
      }
      enterStorePreview(currentStore.publicId, returnPath);
      navigate(`/product/${productId}`);
    },
    [navigate],
  );

  return { openProductPreview };
}

import type { InventoryProductItem } from '../../../../../application/hooks/useInventory';
import { useSellerProductSocialSummary } from '../../../../../application/hooks/useSellerProductSocial';
import { useSeenReviewIds } from '../../../../../application/hooks/useSellerSocialSeen';
import ProductMiniCard from '../ProductMiniCard';

interface InventoryProductRowProps {
  product: InventoryProductItem;
  onClick: () => void;
}

/**
 * Строка товара в секции «Товары»: переиспользует visual ProductMiniCard и
 * добавляет индикатор внимания, если у товара есть непросмотренные отзывы или
 * вопросы без ответа (docs/19 §6.2, Phase D).
 */
export default function InventoryProductRow({ product, onClick }: InventoryProductRowProps) {
  const { reviewIds, unansweredQuestions } = useSellerProductSocialSummary(product.id);
  const seen = useSeenReviewIds(product.id);
  const unreadReviews = reviewIds.filter((id) => !seen.has(id)).length;

  return (
    <ProductMiniCard
      product={product}
      onClick={onClick}
      attention={{ reviews: unreadReviews, questions: unansweredQuestions }}
    />
  );
}

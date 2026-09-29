import { Star } from 'lucide-react';
import ProductTabEmpty from '../inventory/product/ProductTabEmpty';

/** Вкладка «Отзывы». Наполнение появится позже; пока — пустое состояние. */
export default function ProductReviewsView() {
  return (
    <ProductTabEmpty
      icon={<Star size={40} strokeWidth={1.6} />}
      title="Отзывов пока нет"
      hint="Здесь появятся отзывы покупателей по этому товару."
    />
  );
}

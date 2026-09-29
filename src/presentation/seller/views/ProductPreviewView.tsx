import { Eye } from 'lucide-react';
import ProductTabEmpty from '../inventory/product/ProductTabEmpty';

/** Вкладка «Витрина» (вид для покупателя). Наполнение появится позже. */
export default function ProductPreviewView() {
  return (
    <ProductTabEmpty
      icon={<Eye size={40} strokeWidth={1.6} />}
      title="Вид для покупателя"
      hint="Здесь будет карточка товара так, как её видит покупатель."
    />
  );
}

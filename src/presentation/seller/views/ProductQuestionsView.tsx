import { HelpCircle } from 'lucide-react';
import ProductTabEmpty from '../inventory/product/ProductTabEmpty';

/** Вкладка «Вопросы». Наполнение появится позже; пока — пустое состояние. */
export default function ProductQuestionsView() {
  return (
    <ProductTabEmpty
      icon={<HelpCircle size={40} strokeWidth={1.6} />}
      title="Вопросов пока нет"
      hint="Здесь появятся вопросы покупателей и ваши ответы."
    />
  );
}

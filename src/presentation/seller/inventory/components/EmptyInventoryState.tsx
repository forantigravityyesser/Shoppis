import { Package } from 'lucide-react';

interface EmptyInventoryStateProps {
  onAdd: () => void;
}

/** Пустой каталог: красивое состояние вместо «No data». Спека §46. */
export default function EmptyInventoryState({ onAdd }: EmptyInventoryStateProps) {
  return (
    <div className="inv-state inv-state--empty">
      <div className="inv-state__icon" aria-hidden>
        <Package size={40} strokeWidth={1.6} />
      </div>
      <p className="inv-state__title">Ваш каталог пока пуст</p>
      <p className="inv-state__subtitle">Создайте первую категорию или добавьте товар</p>
      <button type="button" className="inv-add-btn" onClick={onAdd}>
        + Добавить
      </button>
    </div>
  );
}

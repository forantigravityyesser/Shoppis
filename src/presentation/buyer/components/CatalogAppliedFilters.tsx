import { X } from 'lucide-react';

interface Props {
  categoryName: string | null;
  priceLabel: string | null;
  onRemoveCategory: () => void;
  onRemovePrice: () => void;
}

/**
 * Чипсы применённых фильтров каталога (категория, цена). Снятие одного чипа
 * убирает только свой параметр и не сбрасывает остальные. Поиск чипом не дублируем —
 * его текст виден в поле поиска. docs/17 §4 (CAT-10).
 */
export default function CatalogAppliedFilters({
  categoryName,
  priceLabel,
  onRemoveCategory,
  onRemovePrice,
}: Props) {
  if (!categoryName && !priceLabel) return null;

  return (
    <div className="catalog-applied" role="group" aria-label="Применённые фильтры">
      {categoryName ? (
        <button
          type="button"
          className="catalog-applied__chip"
          onClick={onRemoveCategory}
          aria-label={`Убрать фильтр «${categoryName}»`}
        >
          <span className="catalog-applied__text">{categoryName}</span>
          <X size={13} strokeWidth={2.8} aria-hidden />
        </button>
      ) : null}
      {priceLabel ? (
        <button
          type="button"
          className="catalog-applied__chip"
          onClick={onRemovePrice}
          aria-label={`Убрать фильтр цены ${priceLabel}`}
        >
          <span className="catalog-applied__text">{priceLabel}</span>
          <X size={13} strokeWidth={2.8} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

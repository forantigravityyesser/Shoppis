import BottomSheet from '../../shared/components/BottomSheet';
import type { StorefrontCategory } from '../../../application/read-models/storefront';
import CategoryItem from './CategoryItem';
import '../category.css';

interface Props {
  open: boolean;
  categories: StorefrontCategory[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}

/**
 * «Все категории» — полный список в порядке продавца. Переиспользует
 * `CategoryItem`; выбор закрывает sheet и пишет `category` в URL. docs/17 §4 (CAT-07c).
 */
export default function AllCategoriesSheet({
  open,
  categories,
  activeId,
  onClose,
  onSelect,
}: Props) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="sheet__title">Все категории</h2>
      <div className="allcats-grid">
        {categories.map((category) => (
          <CategoryItem
            key={category.id}
            id={category.id}
            name={category.name}
            imageUrl={category.imageUrl}
            active={activeId === category.id}
            onSelect={(id) => {
              onSelect(id);
              onClose();
            }}
          />
        ))}
      </div>
    </BottomSheet>
  );
}

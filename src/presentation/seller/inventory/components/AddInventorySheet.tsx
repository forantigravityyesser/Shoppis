import { LayoutGrid, Package } from 'lucide-react';
import BottomSheet from '../../../shared/components/BottomSheet';

interface AddInventorySheetProps {
  open: boolean;
  onClose: () => void;
  onCreateProduct: () => void;
  onCreateCategory: () => void;
}

/** Bottom sheet «Добавить»: только два действия — Товар или Категория. Спека §8. */
export default function AddInventorySheet({
  open,
  onClose,
  onCreateProduct,
  onCreateCategory,
}: AddInventorySheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="sheet__title">Добавить</h2>
      <div className="sheet__options">
        <button type="button" className="sheet-option" onClick={onCreateProduct}>
          <span className="sheet-option__icon" aria-hidden>
            <Package size={26} strokeWidth={1.8} />
          </span>
          <span className="sheet-option__label">Товар</span>
          <span className="sheet-option__hint">Новый товар</span>
        </button>
        <button type="button" className="sheet-option" onClick={onCreateCategory}>
          <span className="sheet-option__icon" aria-hidden>
            <LayoutGrid size={26} strokeWidth={1.8} />
          </span>
          <span className="sheet-option__label">Категория</span>
          <span className="sheet-option__hint">Новая категория</span>
        </button>
      </div>
    </BottomSheet>
  );
}

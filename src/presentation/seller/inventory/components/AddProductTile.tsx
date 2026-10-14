import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AddProductTileProps {
  onClick: () => void;
  label?: string;
}

/** Контекстная плитка «+» в конце превью: создаёт товар в текущей категории. */
export default function AddProductTile({ onClick, label }: AddProductTileProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('seller.inventory.addProduct');
  return (
    <button
      type="button"
      className="inv-thumb inv-thumb--add"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={resolvedLabel}
      title={resolvedLabel}
    >
      <Plus size={18} strokeWidth={2.5} />
    </button>
  );
}

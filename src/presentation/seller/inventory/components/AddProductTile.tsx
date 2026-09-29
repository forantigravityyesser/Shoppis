import { Plus } from 'lucide-react';

interface AddProductTileProps {
  onClick: () => void;
  label?: string;
}

/** Контекстная плитка «+» в конце превью: создаёт товар в текущей категории. */
export default function AddProductTile({ onClick, label = 'Добавить товар' }: AddProductTileProps) {
  return (
    <button
      type="button"
      className="inv-thumb inv-thumb--add"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
    >
      <Plus size={18} strokeWidth={2.5} />
    </button>
  );
}

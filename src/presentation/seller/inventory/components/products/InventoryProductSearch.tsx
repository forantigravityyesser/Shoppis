import { Search, X } from 'lucide-react';

interface InventoryProductSearchProps {
  value: string;
  onChange: (value: string) => void;
}

/** Инлайн-поиск по товарам в секции «Товары» (docs/19 §6.3, Phase D). */
export default function InventoryProductSearch({ value, onChange }: InventoryProductSearchProps) {
  return (
    <div className="inv-search inv-search--section">
      <Search size={16} className="inv-search__icon" aria-hidden />
      <input
        className="inv-search__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Найти товар"
        aria-label="Найти товар"
      />
      {value ? (
        <button
          type="button"
          className="inv-search__clear"
          onClick={() => onChange('')}
          aria-label="Очистить"
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}

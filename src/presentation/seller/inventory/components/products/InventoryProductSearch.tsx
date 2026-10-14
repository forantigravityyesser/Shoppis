import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface InventoryProductSearchProps {
  value: string;
  onChange: (value: string) => void;
}

/** Инлайн-поиск по товарам в секции «Товары» (docs/19 §6.3, Phase D). */
export default function InventoryProductSearch({ value, onChange }: InventoryProductSearchProps) {
  const { t } = useTranslation();
  return (
    <div className="inv-search inv-search--section">
      <Search size={16} className="inv-search__icon" aria-hidden />
      <input
        className="inv-search__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('seller.inventory.categoryView.searchProduct')}
        aria-label={t('seller.inventory.categoryView.searchProduct')}
      />
      {value ? (
        <button
          type="button"
          className="inv-search__clear"
          onClick={() => onChange('')}
          aria-label={t('seller.inventory.categoryPicker.clear')}
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}

import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Поле поиска по названию. Clear-кнопка при непустом значении. docs/13 §8. */
const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar(
  { value, onChange, placeholder },
  ref,
) {
  const { t } = useTranslation();
  return (
    <div className="search-bar">
      <Search className="search-bar__icon" size={19} strokeWidth={2.6} aria-hidden />
      <input
        ref={ref}
        className="search-bar__input"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder ?? t('buyer.catalog.searchPlaceholder')}
        aria-label={t('buyer.catalog.searchAria')}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="search-bar__clear"
          aria-label={t('common.clear')}
          onClick={() => onChange('')}
        >
          <X size={15} strokeWidth={2.8} />
        </button>
      ) : null}
    </div>
  );
});

export default SearchBar;

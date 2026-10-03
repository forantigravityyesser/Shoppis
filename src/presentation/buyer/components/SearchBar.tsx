import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Поле поиска по названию. Clear-кнопка при непустом значении. docs/13 §8. */
const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar(
  { value, onChange, placeholder = 'Найти товар' },
  ref,
) {
  return (
    <div className="search-bar">
      <Search className="search-bar__icon" size={18} strokeWidth={2.4} aria-hidden />
      <input
        ref={ref}
        className="search-bar__input"
        type="search"
        inputMode="search"
        value={value}
        placeholder={placeholder}
        aria-label="Поиск по названию"
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="search-bar__clear"
          aria-label="Очистить"
          onClick={() => onChange('')}
        >
          <X size={16} strokeWidth={2.6} />
        </button>
      ) : null}
    </div>
  );
});

export default SearchBar;

import { ArrowLeft, Search, X } from 'lucide-react';
import BackButton from '../../../shared/components/BackButton';

interface InventoryHeaderProps {
  searchOpen: boolean;
  query: string;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onQueryChange: (value: string) => void;
}

/** Header Home: центрированный заголовок + поиск. */
export default function InventoryHeader({
  searchOpen,
  query,
  onOpenSearch,
  onCloseSearch,
  onQueryChange,
}: InventoryHeaderProps) {
  if (searchOpen) {
    return (
      <div className="inv-header inv-header--search">
        <button
          type="button"
          className="inv-icon-btn"
          onClick={onCloseSearch}
          aria-label="Закрыть поиск"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="inv-search">
          <Search size={16} className="inv-search__icon" aria-hidden />
          <input
            className="inv-search__input"
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCloseSearch();
            }}
            placeholder="Найти товар или категорию"
            aria-label="Найти товар или категорию"
          />
          {query ? (
            <button
              type="button"
              className="inv-search__clear"
              onClick={() => onQueryChange('')}
              aria-label="Очистить"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <header className="inv-header">
      <BackButton fallback="/seller/dashboard" />
      <h1 className="inv-header__title">Инвентарь</h1>
      <button type="button" className="inv-icon-btn" onClick={onOpenSearch} aria-label="Поиск">
        <Search size={20} />
      </button>
    </header>
  );
}

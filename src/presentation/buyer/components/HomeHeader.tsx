import { Search } from 'lucide-react';
import { sellerAvatarInitial } from '../../../domain/rules/seller-avatar';

interface Props {
  storeName: string;
  sellerAvatarUrl: string | null;
  onSearch: () => void;
  onProfile: () => void;
}

/**
 * Шапка витрины: слева название магазина (с усечением), справа поиск и профиль.
 * Уведомлений нет — вместо bell только поиск и аватар. docs/13 §4-5.
 */
export default function HomeHeader({ storeName, sellerAvatarUrl, onSearch, onProfile }: Props) {
  return (
    <header className="home-header">
      <h1 className="home-header__name" title={storeName}>
        {storeName}
      </h1>
      <div className="home-header__actions">
        <button
          type="button"
          className="home-icon-btn"
          aria-label="Поиск"
          onClick={onSearch}
        >
          <Search size={20} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className="home-icon-btn"
          aria-label="Профиль"
          onClick={onProfile}
        >
          {sellerAvatarUrl ? (
            <img className="home-avatar__img" src={sellerAvatarUrl} alt="" decoding="async" />
          ) : (
            <span className="home-avatar__initial" aria-hidden>
              {sellerAvatarInitial(storeName)}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

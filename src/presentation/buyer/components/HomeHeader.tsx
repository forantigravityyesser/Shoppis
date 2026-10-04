import { Search } from 'lucide-react';
import { getInitial } from '../../../domain/rules/initial';
import SafeImage from './SafeImage';

interface Props {
  storeName: string;
  /** Аватар текущего покупателя (`serverUser.photoUrl`); null → инициал. */
  buyerAvatarUrl: string | null;
  /** Имя покупателя (`serverUser.firstName`) для fallback-инициала. */
  buyerName: string;
  onSearch: () => void;
  onProfile: () => void;
}

/**
 * Шапка витрины: слева название магазина (с усечением), справа поиск и профиль.
 * Правый профиль — это аккаунт покупателя (`serverUser`), не продавец. Уведомлений
 * нет — вместо bell только поиск и аватар. docs/15 §3.3.
 */
export default function HomeHeader({
  storeName,
  buyerAvatarUrl,
  buyerName,
  onSearch,
  onProfile,
}: Props) {
  return (
    <header className="home-header">
      <h1 className="home-header__name" title={storeName}>
        {storeName}
      </h1>
      <div className="home-header__actions">
        <button type="button" className="home-icon-btn" aria-label="Поиск" onClick={onSearch}>
          <Search size={20} strokeWidth={2.5} />
        </button>
        <button type="button" className="home-icon-btn" aria-label="Профиль" onClick={onProfile}>
          <SafeImage
            src={buyerAvatarUrl}
            alt=""
            className="home-avatar__img"
            fallback={
              <span className="home-avatar__initial" aria-hidden>
                {getInitial(buyerName)}
              </span>
            }
          />
        </button>
      </div>
    </header>
  );
}

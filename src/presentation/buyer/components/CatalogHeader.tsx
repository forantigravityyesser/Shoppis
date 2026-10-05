import { getInitial } from '../../../domain/rules/initial';
import BackButton from '../../shared/components/BackButton';
import SafeImage from './SafeImage';

interface Props {
  title: string;
  /** Аватар текущего покупателя (`serverUser.photoUrl`); null → инициал. */
  buyerAvatarUrl: string | null;
  /** Имя покупателя для fallback-инициала. */
  buyerName: string;
  onProfile: () => void;
}

/**
 * Шапка каталога в визуале Home: «назад» слева, название по центру, справа —
 * профиль покупателя. Фон (мята/голубой) — от `.home`. docs/17 §4 (CAT-07c).
 */
export default function CatalogHeader({ title, buyerAvatarUrl, buyerName, onProfile }: Props) {
  return (
    <header className="catalog-header">
      <div className="catalog-header__left">
        <BackButton fallback="/" />
      </div>
      <h1 className="catalog-header__title" title={title}>
        {title}
      </h1>
      <div className="catalog-header__actions">
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

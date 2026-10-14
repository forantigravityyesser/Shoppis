import { useRef } from 'react';
import { Info, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getInitial } from '../../../domain/rules/initial';
import SafeImage from '../../shared/components/SafeImage';
import { useStuck } from '../../shared/hooks/useStuck';

interface Props {
  storeName: string;
  /** Публичное описание магазина; null/пусто → кнопка описания не показывается. */
  storeDescription: string | null;
  /** Открыта ли панель описания (для aria-expanded и активного состояния кнопки). */
  descriptionOpen: boolean;
  /** Аватар текущего покупателя (`serverUser.photoUrl`); null → инициал. */
  buyerAvatarUrl: string | null;
  /** Имя покупателя (`serverUser.firstName`) для fallback-инициала. */
  buyerName: string;
  onSearch: () => void;
  onProfile: () => void;
  onToggleDescription: () => void;
}

/**
 * Шапка витрины: слева название магазина (с усечением), справа — кнопка
 * описания магазина (только если описание задано), поиск и профиль покупателя.
 * Уведомлений нет. docs/15 §3.3.
 *
 * Иконки живут в залипающем рейле: пока шапка видна — они в шапке, при скролле
 * залипают справа вверху и становятся прозрачнее. Логика кнопок не меняется.
 */
export default function HomeHeader({
  storeName,
  storeDescription,
  descriptionOpen,
  buyerAvatarUrl,
  buyerName,
  onSearch,
  onProfile,
  onToggleDescription,
}: Props) {
  const { t } = useTranslation();
  const headerRef = useRef<HTMLElement>(null);
  const stuck = useStuck(headerRef);
  const floating = stuck ? ' home-icon-btn--floating' : '';
  const hasDescription = Boolean(storeDescription && storeDescription.trim());

  return (
    <>
      <div className="sticky-rail sticky-rail--end buyer-header-rail">
        <div className="home-header__actions">
          {hasDescription ? (
            <button
              type="button"
              className={`home-icon-btn${floating}${descriptionOpen ? ' home-icon-btn--active' : ''}`}
              aria-label={t('buyer.home.descriptionAria')}
              aria-expanded={descriptionOpen}
              onClick={onToggleDescription}
            >
              <Info size={20} strokeWidth={2.5} />
            </button>
          ) : null}
          <button
            type="button"
            className={`home-icon-btn${floating}`}
            aria-label={t('buyer.home.searchAria')}
            onClick={onSearch}
          >
            <Search size={20} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className={`home-icon-btn${floating}`}
            aria-label={t('buyer.home.profileAria')}
            onClick={onProfile}
          >
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
      </div>

      <header className="home-header" ref={headerRef}>
        <h1 className="home-header__name" title={storeName}>
          {storeName}
        </h1>
        <div className="home-header__actions home-header__actions--ghost" aria-hidden>
          {hasDescription ? <span className="home-icon-btn" aria-hidden /> : null}
          <span className="home-icon-btn" aria-hidden />
          <span className="home-icon-btn" aria-hidden />
        </div>
      </header>
    </>
  );
}

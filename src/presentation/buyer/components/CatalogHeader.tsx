import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getInitial } from '../../../domain/rules/initial';
import BackButton from '../../shared/components/BackButton';
import SafeImage from '../../shared/components/SafeImage';
import { useStuck } from '../../shared/hooks/useStuck';

interface Props {
  title: string;
  /** Аватар текущего покупателя (`serverUser.photoUrl`); null → инициал. */
  buyerAvatarUrl: string | null;
  /** Имя покупателя для fallback-инициала. */
  buyerName: string;
  onProfile: () => void;
  /** Доп. действие справа (перед профилем), напр. кнопка обновления заказов. */
  trailing?: ReactNode;
}

/**
 * Шапка каталога в визуале Home: «назад» слева, название по центру, справа —
 * действия (опционально) и профиль покупателя. Фон (мята/голубой) — от `.home`.
 * docs/17 §4 (CAT-07c).
 *
 * «Назад», действия и профиль залипают при скролле: пока шапка видна — в шапке,
 * ниже — в общем рейле вверху (слева/справа) и становятся прозрачнее. Логика
 * кнопок не меняется; дубль-рейл монтируется только когда шапка уехала.
 */
export default function CatalogHeader({
  title,
  buyerAvatarUrl,
  buyerName,
  onProfile,
  trailing,
}: Props) {
  const { t } = useTranslation();
  const headerRef = useRef<HTMLElement>(null);
  const stuck = useStuck(headerRef);

  const profileButton = (floating: boolean) => (
    <button
      type="button"
      className={`home-icon-btn${floating ? ' home-icon-btn--floating' : ''}`}
      aria-label={t('buyer.catalog.profileAria')}
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
  );

  return (
    <>
      {stuck ? (
        <div className="sticky-rail sticky-rail--between buyer-header-rail">
          <BackButton fallback="/" className="back-btn--floating" />
          <div className="catalog-header__actions">
            {trailing}
            {profileButton(true)}
          </div>
        </div>
      ) : null}

      <header className="catalog-header" ref={headerRef}>
        <div className="catalog-header__left">
          <BackButton fallback="/" />
        </div>
        <h1 className="catalog-header__title" title={title}>
          {title}
        </h1>
        <div className="catalog-header__actions">
          {trailing}
          {profileButton(false)}
        </div>
      </header>
    </>
  );
}

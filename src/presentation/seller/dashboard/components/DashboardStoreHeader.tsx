import { useTranslation } from 'react-i18next';
import type { Store } from '../../../../domain/models/store';
import { getInitial } from '../../../../domain/rules/initial';
import SafeImage from '../../../shared/components/SafeImage';

interface Props {
  store: Store;
}

/**
 * Шапка главной продавца: логотип, крупное название магазина и чип статуса.
 * Продавец сразу видит, в каком магазине он находится (docs/25 SDB-05).
 */
export default function DashboardStoreHeader({ store }: Props) {
  const { t } = useTranslation();
  const paused = store.status === 'PAUSED';

  return (
    <header className="dash-store">
      <div className="dash-store__avatar">
        <SafeImage
          src={store.logoUrl || null}
          alt=""
          className="dash-store__logo"
          fallback={<span className="dash-store__initial">{getInitial(store.name)}</span>}
        />
      </div>
      <div className="dash-store__info">
        <h1 className="dash-store__name" title={store.name}>
          {store.name}
        </h1>
        <span className={`dash-store__status${paused ? ' dash-store__status--paused' : ''}`}>
          <span className="dash-store__dot" aria-hidden />
          {paused ? t('seller.dashboard.store.paused') : t('seller.dashboard.store.active')}
        </span>
      </div>
    </header>
  );
}

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  loading: boolean;
  error: string | null;
  notFound: boolean;
  onRetry: () => void;
  children: ReactNode;
}

/**
 * Единое состояние загрузки магазина продавца (R4): спиннер → ошибка с повтором →
 * «магазин не найден» → контент. Ошибка чтения и отсутствие магазина различаются.
 */
export default function StoreLoadState({ loading, error, notFound, onRetry, children }: Props) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="card card__muted store-state" role="status" aria-live="polite">
        {t('seller.settings.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card store-state store-state--error" role="alert">
        <p className="store-state__title">{t('seller.settings.loadErrorTitle')}</p>
        <p className="store-state__text">{t('seller.settings.loadErrorText')}</p>
        <button type="button" className="store-state__retry" onClick={onRetry}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="card card__muted store-state" role="status">
        {t('seller.settings.notFound')}
      </div>
    );
  }

  return <>{children}</>;
}

import { useTranslation } from 'react-i18next';

interface Props {
  onRetry: () => void;
  title?: string;
  text?: string;
}

/** Состояние ошибки главной продавца с повтором (docs/25 SDB-05). */
export default function DashboardError({ onRetry, title, text }: Props) {
  const { t } = useTranslation();
  return (
    <div className="dash-error" role="alert" data-testid="dashboard-error">
      <p className="dash-error__title">{title ?? t('seller.dashboard.error.title')}</p>
      <p className="dash-error__text">{text ?? t('seller.dashboard.error.text')}</p>
      <button type="button" className="dash-retry" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  );
}

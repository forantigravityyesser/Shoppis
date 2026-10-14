import { useTranslation } from 'react-i18next';
import DashboardCard from './DashboardCard';

/**
 * Блок «Требует внимания» (docs/25 §4.4): плейсхолдер о будущих улучшениях
 * приложения. В рамках захода содержание не меняется по существу.
 */
export default function AttentionBlock() {
  const { t } = useTranslation();
  return (
    <DashboardCard title={t('seller.dashboard.attention.title')}>
      <p className="dash-attention__text">{t('seller.dashboard.attention.text')}</p>
    </DashboardCard>
  );
}

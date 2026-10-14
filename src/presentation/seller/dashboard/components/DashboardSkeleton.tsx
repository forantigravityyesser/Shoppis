import { useTranslation } from 'react-i18next';

/**
 * Скелетон главной продавца (docs/25 SDB-05): четыре карточки-блока.
 * Live-статус для screen reader; визуальные блоки скрыты от него.
 */
export default function DashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="dash-skeleton" role="status" aria-label={t('seller.dashboard.skeletonAria')}>
      <span className="dash-sr-only">{t('common.loading')}</span>
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="dash-skeleton__card" aria-hidden>
          <span className="dash-skeleton__line dash-skeleton__line--title" />
          <span className="dash-skeleton__line" />
        </div>
      ))}
    </div>
  );
}

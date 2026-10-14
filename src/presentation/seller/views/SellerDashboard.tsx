import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useSellerDashboard } from '../../../application/hooks/useSellerDashboard';
import { currencySymbol } from '../../../domain/constants/currencies';
import DashboardSalesBlock from '../dashboard/components/DashboardSalesBlock';
import DashboardOrdersBlock from '../dashboard/components/DashboardOrdersBlock';
import DashboardInventoryBlock from '../dashboard/components/DashboardInventoryBlock';
import DashboardSkeleton from '../dashboard/components/DashboardSkeleton';
import DashboardError from '../dashboard/components/DashboardError';
import DashboardEmpty from '../dashboard/components/DashboardEmpty';
import AttentionBlock from '../dashboard/components/AttentionBlock';
import '../dashboard/dashboard.css';

/**
 * Операционная панель продавца (docs/25). Один серверный read (`useSellerDashboard`)
 * + состояния. Блоки Продажи/Заказы/Инвентарь (SDB-06…08); «Требует внимания» —
 * плейсхолдер.
 */
export default function SellerDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentStore = useStore((s) => s.currentStore);
  const { summary, loading, error, disabledReason, refetch } = useSellerDashboard();

  const symbol = currentStore
    ? currentStore.currencySymbol || currencySymbol(currentStore.currencyCode)
    : '';

  const body = error ? (
    <DashboardError onRetry={refetch} />
  ) : loading ? (
    <DashboardSkeleton />
  ) : disabledReason ? (
    <DashboardEmpty
      title={t('seller.dashboard.empty.noStoreTitle')}
      text={t('seller.dashboard.empty.noStoreText')}
    />
  ) : !summary ? (
    <DashboardEmpty
      title={t('seller.dashboard.empty.noSummaryTitle')}
      text={t('seller.dashboard.empty.noSummaryText')}
    />
  ) : (
    <>
      <DashboardSalesBlock
        sales={summary.sales}
        currencySymbol={symbol}
        onOpen={() => navigate('/seller/sales')}
      />
      <DashboardOrdersBlock
        counts={summary.orders}
        onOpenAll={() => navigate('/seller/orders')}
        onOpenStatus={(filter) => navigate(`/seller/orders?status=${filter}`)}
      />
      <DashboardInventoryBlock
        inventory={summary.inventory}
        onOpenProducts={() => navigate('/seller/inventory')}
        onOpenCategories={() => navigate('/seller/inventory?mode=categories')}
      />
      <AttentionBlock />
    </>
  );

  return (
    <div className="screen dash">
      <div className="screen__header">
        <h1 className="screen__title">{t('seller.dashboard.title')}</h1>
        {currentStore ? <p className="screen__subtitle">{currentStore.name}</p> : null}
      </div>
      {body}
    </div>
  );
}

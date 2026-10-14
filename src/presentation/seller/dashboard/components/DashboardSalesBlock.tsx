import { useTranslation } from 'react-i18next';
import type { SellerDashboardSales } from '../../../../application/read-models/seller-dashboard';
import DashboardCard from './DashboardCard';
import DashboardMoney from './DashboardMoney';

interface Props {
  sales: SellerDashboardSales;
  currencySymbol: string;
  /** Клик по любой из карточек → экран «Продажи». */
  onOpen: () => void;
}

/**
 * Блок «Продажи» главной продавца (docs/25 §1.2/§4.3): две карточки рядом —
 * «Заработано» (зелёная) и «Потенциально» (жёлтая). Обе ведут на экран «Продажи».
 */
export default function DashboardSalesBlock({ sales, currencySymbol, onOpen }: Props) {
  const { t } = useTranslation();
  return (
    <div className="dash-row" data-testid="dashboard-sales">
      <DashboardCard title={t('seller.dashboard.sales.earned')} onClick={onOpen}>
        <DashboardMoney minor={sales.receivedMinor} symbol={currencySymbol} tone="earned" />
      </DashboardCard>
      <DashboardCard title={t('seller.dashboard.sales.potential')} onClick={onOpen}>
        <DashboardMoney minor={sales.frozenMinor} symbol={currencySymbol} tone="frozen" />
      </DashboardCard>
    </div>
  );
}

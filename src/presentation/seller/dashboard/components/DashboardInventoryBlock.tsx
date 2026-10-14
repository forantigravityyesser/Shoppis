import { useTranslation } from 'react-i18next';
import type { SellerDashboardInventory } from '../../../../application/read-models/seller-dashboard';
import DashboardCard from './DashboardCard';
import DashboardStat from './DashboardStat';

interface Props {
  inventory: SellerDashboardInventory;
  /** Клик по карточке «Товары» → раздел «Товары» инвентаря. */
  onOpenProducts: () => void;
  /** Клик по карточке «Категории» → раздел «Категории» инвентаря. */
  onOpenCategories: () => void;
}

/**
 * Блок «Инвентарь» главной продавца (docs/25 §1.3/§4.2): рядом две карточки —
 * «Товары» (на витрине / в архиве) и «Категории» (активные). Каждая ведёт в свою
 * секцию инвентаря.
 */
export default function DashboardInventoryBlock({
  inventory,
  onOpenProducts,
  onOpenCategories,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="dash-row">
      <DashboardCard title={t('seller.dashboard.inventory.title')} onClick={onOpenProducts}>
        <div className="dash-stats dash-stats--compact">
          <DashboardStat
            label={t('seller.dashboard.inventory.onShelf')}
            value={inventory.activeProducts}
            tone="active"
            ariaLabel={t('seller.dashboard.inventory.onShelfAria', {
              value: inventory.activeProducts,
            })}
          />
          <DashboardStat
            label={t('seller.dashboard.inventory.archived')}
            value={inventory.archivedProducts}
            tone="archive"
            ariaLabel={t('seller.dashboard.inventory.archivedAria', {
              value: inventory.archivedProducts,
            })}
          />
        </div>
      </DashboardCard>
      <DashboardCard title={t('seller.dashboard.inventory.categories')} onClick={onOpenCategories}>
        <div className="dash-stats dash-stats--compact">
          <DashboardStat
            label={t('seller.dashboard.inventory.active')}
            value={inventory.activeCategories}
            tone="neutral"
            ariaLabel={t('seller.dashboard.inventory.activeAria', {
              value: inventory.activeCategories,
            })}
          />
        </div>
      </DashboardCard>
    </div>
  );
}

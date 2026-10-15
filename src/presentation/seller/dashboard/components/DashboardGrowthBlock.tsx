import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { PackageCheck, ShoppingBag, Truck, Trophy } from 'lucide-react';
import type { SellerDashboardGrowth } from '../../../../application/read-models/seller-dashboard';
import { resolveGrowthGoal } from '../../../../domain/rules/growth-rules';
import type { GrowthGoalKey } from '../../../../domain/models/tutorial';

interface Props {
  growth: SellerDashboardGrowth;
  /** CTA первой цели — поделиться витриной (ведёт на экран шаринга). */
  onShare: () => void;
}

type TextKey = ParseKeys;

const GOAL_META: Record<
  GrowthGoalKey,
  { icon: typeof ShoppingBag; titleKey: TextKey; textKey: TextKey }
> = {
  'first-order': {
    icon: ShoppingBag,
    titleKey: 'seller.dashboard.growth.goals.firstOrder.title',
    textKey: 'seller.dashboard.growth.goals.firstOrder.text',
  },
  'first-shipped': {
    icon: Truck,
    titleKey: 'seller.dashboard.growth.goals.firstShipped.title',
    textKey: 'seller.dashboard.growth.goals.firstShipped.text',
  },
  'first-completed': {
    icon: PackageCheck,
    titleKey: 'seller.dashboard.growth.goals.firstCompleted.title',
    textKey: 'seller.dashboard.growth.goals.firstCompleted.text',
  },
};

/**
 * Блок «Развитие магазина» (docs/26 §4.6, TUT-08): показывает ОДНУ ближайшую цель,
 * вычисленную из серверных фактов заказов. Будущие цели скрыты; когда все достигнуты —
 * положительное состояние. Ручной отметки нет — только факты (docs/26 §1.7).
 */
export default function DashboardGrowthBlock({ growth, onShare }: Props) {
  const { t } = useTranslation();
  const goal = resolveGrowthGoal(growth);

  if (!goal) {
    return (
      <section className="dash-card dash-growth" data-testid="dashboard-growth">
        <div className="dash-growth__head">
          <span className="dash-growth__icon dash-growth__icon--done" aria-hidden>
            <Trophy size={20} />
          </span>
          <span className="dash-growth__label">{t('seller.dashboard.growth.title')}</span>
        </div>
        <h3 className="dash-growth__goal-title">{t('seller.dashboard.growth.allDoneTitle')}</h3>
        <p className="dash-growth__goal-text">{t('seller.dashboard.growth.allDoneText')}</p>
      </section>
    );
  }

  const meta = GOAL_META[goal.key];
  const Icon = meta.icon;

  return (
    <section className="dash-card dash-growth" data-testid="dashboard-growth">
      <div className="dash-growth__head">
        <span className="dash-growth__icon" aria-hidden>
          <Icon size={20} />
        </span>
        <span className="dash-growth__label">{t('seller.dashboard.growth.title')}</span>
      </div>
      <h3 className="dash-growth__goal-title">{t(meta.titleKey)}</h3>
      <p className="dash-growth__goal-text">{t(meta.textKey)}</p>
      {goal.key === 'first-order' ? (
        <button type="button" className="dash-growth__cta" onClick={onShare}>
          {t('seller.dashboard.growth.cta')}
        </button>
      ) : null}
    </section>
  );
}

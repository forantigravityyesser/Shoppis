import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useSellerDashboard } from '../../../application/hooks/useSellerDashboard';
import { useDashboardTutorial } from '../../../application/hooks/useDashboardTutorial';
import { currencySymbol } from '../../../domain/constants/currencies';
import { computeShopReadiness } from '../../../domain/rules/readiness-rules';
import DashboardStoreHeader from '../dashboard/components/DashboardStoreHeader';
import DashboardChecklistBlock from '../dashboard/components/DashboardChecklistBlock';
import DashboardGrowthBlock from '../dashboard/components/DashboardGrowthBlock';
import DashboardSalesBlock from '../dashboard/components/DashboardSalesBlock';
import DashboardOrdersBlock from '../dashboard/components/DashboardOrdersBlock';
import DashboardInventoryBlock from '../dashboard/components/DashboardInventoryBlock';
import DashboardSkeleton from '../dashboard/components/DashboardSkeleton';
import DashboardError from '../dashboard/components/DashboardError';
import DashboardEmpty from '../dashboard/components/DashboardEmpty';
import TutorialWelcomeSheet from '../tutorial/TutorialWelcomeSheet';
import '../dashboard/dashboard.css';

/**
 * Операционная панель продавца (docs/25). Один серверный read (`useSellerDashboard`)
 * + состояния. Блоки: чек-лист подготовки (docs/26 §4.5, первым), Продажи/Заказы/Инвентарь.
 * Обучение (docs/26 §4.1): welcome-шит при первом входе + ручной запуск из чек-листа;
 * шаги/подсветка — глобальный `TutorialOverlay` в seller-shell.
 */
export default function SellerDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentStore = useStore((s) => s.currentStore);
  const { summary, loading, error, disabledReason, refetch } = useSellerDashboard();
  const tutorial = useDashboardTutorial();

  const symbol = currentStore
    ? currentStore.currencySymbol || currencySymbol(currentStore.currencyCode)
    : '';

  // Обучение оркеструется хуком (R5): главная получает готовый CTA, не владея
  // жизненным циклом. Ручной вход: «Продолжить обучение» / «Пройти обучение».
  const cta = tutorial.cta;
  const tutorialCta = cta
    ? { label: t(`seller.tutorial.${cta.kind}`), onClick: cta.onClick }
    : undefined;

  // Готовность магазина (docs/26 §3.4): derived из `currentStore` + серверных counts.
  const readiness =
    summary && currentStore
      ? computeShopReadiness({
          storeName: currentStore.name ?? '',
          bannerUrl: currentStore.bannerUrl ?? '',
          description: currentStore.description ?? '',
          supportHandle: currentStore.supportHandle ?? '',
          buyerAvailableProducts: summary.inventory.buyerAvailableProducts,
          activeCategories: summary.inventory.activeCategories,
        })
      : null;

  // Восстановление недоступной сессии: переинициализация приложения (повторный вход).
  const reloadApp = () => {
    window.location.reload();
  };

  const body = error ? (
    <DashboardError onRetry={refetch} />
  ) : loading ? (
    <DashboardSkeleton />
  ) : disabledReason === 'no-store' ? (
    <DashboardEmpty
      title={t('seller.dashboard.empty.noStoreTitle')}
      text={t('seller.dashboard.empty.noStoreText')}
    />
  ) : disabledReason === 'no-session' ? (
    <DashboardEmpty
      title={t('seller.dashboard.empty.noSessionTitle')}
      text={t('seller.dashboard.empty.noSessionText')}
      action={{ label: t('seller.dashboard.empty.retry'), onClick: reloadApp }}
    />
  ) : disabledReason === 'disabled' ? (
    <DashboardEmpty
      title={t('seller.dashboard.empty.disabledTitle')}
      text={t('seller.dashboard.empty.disabledText')}
    />
  ) : !summary ? (
    <DashboardEmpty
      title={t('seller.dashboard.empty.noSummaryTitle')}
      text={t('seller.dashboard.empty.noSummaryText')}
    />
  ) : (
    <>
      {/* docs/26 §4.5: при готовности магазина (5/5) чек-лист убирается —
          «Развитие магазина» остаётся единственным блоком такого формата. */}
      {readiness && !readiness.preparationReady ? (
        <DashboardChecklistBlock tutorialCta={tutorialCta} readiness={readiness} />
      ) : null}
      <DashboardGrowthBlock
        growth={summary.growth}
        onShare={() => navigate('/seller/settings/share')}
      />
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
    </>
  );

  return (
    <div className="screen dash">
      {currentStore ? (
        <DashboardStoreHeader store={currentStore} />
      ) : (
        <div className="screen__header">
          <h1 className="screen__title">{t('seller.dashboard.title')}</h1>
        </div>
      )}
      {body}
      <TutorialWelcomeSheet
        open={tutorial.welcomeOpen}
        onStart={tutorial.start}
        onDecline={tutorial.decline}
      />
    </div>
  );
}
